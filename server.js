const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// ===== CONFIGURATION FIREBASE ADMIN =====
let firebaseInitialized = false;

try {
    // Vérifier si les variables d'environnement sont présentes
    if (!process.env.FIREBASE_SERVICE_ACCOUNT || !process.env.FIREBASE_DATABASE_URL) {
        throw new Error('Variables d\'environnement Firebase manquantes');
    }

    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    
    // Initialiser Firebase Admin SDK une seule fois
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: process.env.FIREBASE_DATABASE_URL
        });
        console.log('✅ Firebase Admin SDK initialisé avec succès');
    }
    
    firebaseInitialized = true;
} catch (error) {
    console.error('❌ Erreur d\'initialisation Firebase Admin:', error.message);
    process.exit(1);
}

const db = admin.database();
const auth = admin.auth();

// ===== MIDDLEWARE =====

// Sécurité
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
        },
    },
}));

// CORS configuré pour votre domaine
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting pour éviter les abus
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limite chaque IP à 100 requêtes par fenêtre
    message: { error: 'Trop de requêtes, veuillez réessayer plus tard.' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/', apiLimiter);

// ===== MIDDLEWARE D'AUTHENTIFICATION AMÉLIORÉ =====

/**
 * Middleware pour vérifier l'authentification Firebase
 * Vérifie le token JWT et attache l'utilisateur à la requête
 */
const authenticateFirebaseUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                error: 'Non autorisé',
                message: 'Token d\'authentification manquant' 
            });
        }
        
        const token = authHeader.split('Bearer ')[1];
        
        // Vérifier et décoder le token
        const decodedToken = await auth.verifyIdToken(token);
        
        // Récupérer les informations complètes de l'utilisateur
        const user = await auth.getUser(decodedToken.uid);
        
        // Attacher l'utilisateur à la requête
        req.user = {
            uid: user.uid,
            email: user.email,
            emailVerified: user.emailVerified,
            displayName: user.displayName,
            phoneNumber: user.phoneNumber,
            photoURL: user.photoURL,
            disabled: user.disabled,
            metadata: user.metadata,
            providerData: user.providerData
        };
        
        console.log(`✅ Utilisateur authentifié: ${user.email} (${user.uid})`);
        next();
        
    } catch (error) {
        console.error('❌ Erreur d\'authentification:', error.message);
        
        let statusCode = 401;
        let errorMessage = 'Token invalide ou expiré';
        
        if (error.code === 'auth/id-token-expired') {
            errorMessage = 'Token expiré, veuillez vous reconnecter';
        } else if (error.code === 'auth/id-token-revoked') {
            errorMessage = 'Token révoqué';
        } else if (error.code === 'auth/user-not-found') {
            statusCode = 404;
            errorMessage = 'Utilisateur non trouvé';
        }
        
        res.status(statusCode).json({ 
            error: 'Authentification échouée',
            message: errorMessage,
            code: error.code
        });
    }
};

/**
 * Middleware pour vérifier si l'utilisateur est administrateur
 */
const requireAdmin = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Utilisateur non authentifié' });
        }
        
        // Vérifier dans la base de données Firebase
        const adminRef = db.ref('admin');
        const snapshot = await adminRef
            .orderByChild('email')
            .equalTo(req.user.email)
            .once('value');
        
        const adminData = snapshot.val();
        
        if (!adminData) {
            return res.status(403).json({ 
                error: 'Accès refusé',
                message: 'Vous n\'avez pas les permissions d\'administrateur' 
            });
        }
        
        req.user.isAdmin = true;
        next();
        
    } catch (error) {
        console.error('Erreur lors de la vérification admin:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
};

/**
 * Middleware pour vérifier si l'utilisateur est fournisseur
 */
const requireSupplier = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Utilisateur non authentifié' });
        }
        
        // Vérifier dans la base de données Firebase
        const suppliersRef = db.ref('fournisseur');
        const snapshot = await suppliersRef.once('value');
        const suppliers = snapshot.val();
        
        let isSupplier = false;
        let supplierData = null;
        
        if (suppliers) {
            for (const supplierId in suppliers) {
                const supplier = suppliers[supplierId];
                if (supplier.email === req.user.email || supplier.id === req.user.uid) {
                    isSupplier = true;
                    supplierData = {
                        id: supplierId,
                        ...supplier
                    };
                    break;
                }
            }
        }
        
        if (!isSupplier) {
            return res.status(403).json({ 
                error: 'Accès refusé',
                message: 'Vous n\'avez pas les permissions de fournisseur' 
            });
        }
        
        req.user.isSupplier = true;
        req.user.supplierData = supplierData;
        next();
        
    } catch (error) {
        console.error('Erreur lors de la vérification fournisseur:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
};

// ===== ROUTES DE SANTÉ ET INFORMATION =====

/**
 * @route GET /api/health
 * @description Vérifie l'état du serveur et de Firebase
 * @access Public
 */
app.get('/api/health', async (req, res) => {
    try {
        const healthData = {
            status: 'OK',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            firebase: firebaseInitialized ? 'connected' : 'disconnected',
            database: 'unknown',
            memory: process.memoryUsage()
        };
        
        // Tester la connexion à la base de données
        if (firebaseInitialized) {
            try {
                await db.ref('.info/connected').once('value');
                healthData.database = 'connected';
            } catch (dbError) {
                healthData.database = 'error';
                healthData.databaseError = dbError.message;
            }
        }
        
        res.json(healthData);
        
    } catch (error) {
        console.error('Erreur dans /api/health:', error);
        res.status(500).json({ 
            status: 'ERROR',
            error: error.message 
        });
    }
});

/**
 * @route GET /api/info
 * @description Informations sur l'API
 * @access Public
 */
app.get('/api/info', (req, res) => {
    res.json({
        name: 'PrixMatHaïti API',
        version: '1.0.0',
        description: 'API backend pour le système de comparaison de prix de matériaux en Haïti',
        endpoints: {
            health: '/api/health',
            info: '/api/info',
            auth: {
                checkRoles: '/api/check-roles',
                checkSupplier: '/api/check-supplier',
                checkAdmin: '/api/check-admin'
            },
            user: {
                profile: '/api/user/profile',
                update: '/api/user/update'
            }
        },
        environment: process.env.NODE_ENV || 'development'
    });
});

// ===== ROUTES D'AUTHENTIFICATION ET RÔLES =====

/**
 * @route GET /api/check-roles
 * @description Vérifie tous les rôles d'un utilisateur
 * @access Private (authentifié)
 */
app.get('/api/check-roles', authenticateFirebaseUser, async (req, res) => {
    try {
        const user = req.user;
        
        console.log(`🔍 Vérification des rôles pour: ${user.email}`);
        
        // Vérifier le statut fournisseur
        const suppliersRef = db.ref('fournisseur');
        const suppliersSnapshot = await suppliersRef.once('value');
        const suppliers = suppliersSnapshot.val();
        
        let isSupplier = false;
        let supplierData = null;
        
        if (suppliers) {
            for (const supplierId in suppliers) {
                const supplier = suppliers[supplierId];
                if (supplier.email === user.email || supplier.id === user.uid) {
                    isSupplier = true;
                    supplierData = {
                        id: supplierId,
                        name: supplier.name,
                        departement: supplier.departement,
                        telephone: supplier.telephone,
                        address: supplier.address
                    };
                    break;
                }
            }
        }
        
        // Vérifier le statut admin
        const adminRef = db.ref('admin');
        const adminSnapshot = await adminRef
            .orderByChild('email')
            .equalTo(user.email)
            .once('value');
        const adminData = adminSnapshot.val();
        const isAdmin = adminData !== null;
        
        const response = {
            user: {
                uid: user.uid,
                email: user.email,
                emailVerified: user.emailVerified,
                displayName: user.displayName
            },
            roles: {
                isSupplier,
                isAdmin,
                isAuthenticated: true
            },
            supplier: supplierData,
            timestamp: new Date().toISOString()
        };
        
        console.log(`✅ Rôles vérifiés pour ${user.email}:`, {
            isSupplier,
            isAdmin
        });
        
        res.json(response);
        
    } catch (error) {
        console.error('❌ Erreur lors de la vérification des rôles:', error);
        res.status(500).json({ 
            error: 'Erreur interne du serveur',
            message: error.message 
        });
    }
});

/**
 * @route GET /api/check-supplier
 * @description Vérifie si l'utilisateur est un fournisseur
 * @access Private (authentifié)
 */
app.get('/api/check-supplier', authenticateFirebaseUser, async (req, res) => {
    try {
        const user = req.user;
        
        console.log(`🔍 Vérification statut fournisseur pour: ${user.email}`);
        
        const suppliersRef = db.ref('fournisseur');
        const snapshot = await suppliersRef.once('value');
        const suppliers = snapshot.val();
        
        let isSupplier = false;
        let supplierData = null;
        
        if (suppliers) {
            for (const supplierId in suppliers) {
                const supplier = suppliers[supplierId];
                if (supplier.email === user.email || supplier.id === user.uid) {
                    isSupplier = true;
                    supplierData = {
                        id: supplierId,
                        name: supplier.name,
                        departement: supplier.departement
                    };
                    break;
                }
            }
        }
        
        const response = {
            isSupplier,
            supplier: supplierData,
            user: {
                uid: user.uid,
                email: user.email
            },
            timestamp: new Date().toISOString()
        };
        
        console.log(`✅ Statut fournisseur pour ${user.email}:`, isSupplier);
        
        res.json(response);
        
    } catch (error) {
        console.error('❌ Erreur lors de la vérification fournisseur:', error);
        res.status(500).json({ 
            error: 'Erreur interne du serveur',
            message: error.message 
        });
    }
});

/**
 * @route GET /api/check-admin
 * @description Vérifie si l'utilisateur est un administrateur
 * @access Private (authentifié)
 */
app.get('/api/check-admin', authenticateFirebaseUser, async (req, res) => {
    try {
        const user = req.user;
        
        console.log(`🔍 Vérification statut admin pour: ${user.email}`);
        
        const adminRef = db.ref('admin');
        const snapshot = await adminRef
            .orderByChild('email')
            .equalTo(user.email)
            .once('value');
        const adminData = snapshot.val();
        
        const isAdmin = adminData !== null;
        const adminInfo = isAdmin ? Object.values(adminData)[0] : null;
        
        const response = {
            isAdmin,
            admin: adminInfo,
            user: {
                uid: user.uid,
                email: user.email
            },
            timestamp: new Date().toISOString()
        };
        
        console.log(`✅ Statut admin pour ${user.email}:`, isAdmin);
        
        res.json(response);
        
    } catch (error) {
        console.error('❌ Erreur lors de la vérification admin:', error);
        res.status(500).json({ 
            error: 'Erreur interne du serveur',
            message: error.message 
        });
    }
});

// ===== ROUTES UTILISATEUR =====

/**
 * @route GET /api/user/profile
 * @description Récupère le profil complet de l'utilisateur
 * @access Private (authentifié)
 */
app.get('/api/user/profile', authenticateFirebaseUser, async (req, res) => {
    try {
        const user = req.user;
        
        // Récupérer des données supplémentaires si nécessaire
        const userProfile = {
            uid: user.uid,
            email: user.email,
            emailVerified: user.emailVerified,
            displayName: user.displayName,
            phoneNumber: user.phoneNumber,
            photoURL: user.photoURL,
            metadata: {
                creationTime: user.metadata.creationTime,
                lastSignInTime: user.metadata.lastSignInTime
            },
            providerData: user.providerData
        };
        
        res.json({
            success: true,
            profile: userProfile,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Erreur lors de la récupération du profil:', error);
        res.status(500).json({ 
            error: 'Erreur interne du serveur',
            message: error.message 
        });
    }
});

/**
 * @route PUT /api/user/update
 * @description Met à jour le profil utilisateur
 * @access Private (authentifié)
 */
app.put('/api/user/update', authenticateFirebaseUser, async (req, res) => {
    try {
        const user = req.user;
        const updates = req.body;
        
        // Valider les champs pouvant être mis à jour
        const allowedUpdates = ['displayName', 'photoURL'];
        const filteredUpdates = {};
        
        for (const key of allowedUpdates) {
            if (updates[key] !== undefined) {
                filteredUpdates[key] = updates[key];
            }
        }
        
        if (Object.keys(filteredUpdates).length === 0) {
            return res.status(400).json({ 
                error: 'Aucune mise à jour valide fournie',
                allowedUpdates 
            });
        }
        
        // Mettre à jour l'utilisateur dans Firebase Auth
        await auth.updateUser(user.uid, filteredUpdates);
        
        res.json({
            success: true,
            message: 'Profil mis à jour avec succès',
            updates: filteredUpdates,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Erreur lors de la mise à jour du profil:', error);
        res.status(500).json({ 
            error: 'Erreur interne du serveur',
            message: error.message 
        });
    }
});

// ===== ROUTES ADMIN (EXEMPLE) =====

/**
 * @route GET /api/admin/users
 * @description Récupère la liste des utilisateurs (admin seulement)
 * @access Private (admin)
 */
app.get('/api/admin/users', authenticateFirebaseUser, requireAdmin, async (req, res) => {
    try {
        // Récupérer la liste des utilisateurs
        const listUsersResult = await auth.listUsers(100); // Limité à 100 utilisateurs
        
        const users = listUsersResult.users.map(user => ({
            uid: user.uid,
            email: user.email,
            emailVerified: user.emailVerified,
            displayName: user.displayName,
            disabled: user.disabled,
            metadata: {
                creationTime: user.metadata.creationTime,
                lastSignInTime: user.metadata.lastSignInTime
            }
        }));
        
        res.json({
            success: true,
            count: users.length,
            users: users,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Erreur lors de la récupération des utilisateurs:', error);
        res.status(500).json({ 
            error: 'Erreur interne du serveur',
            message: error.message 
        });
    }
});

// ===== GESTION DES ERREURS =====

// Route 404
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route non trouvée',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
    });
});

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
    console.error('❌ Erreur non gérée:', err);
    
    res.status(err.status || 500).json({
        error: 'Erreur interne du serveur',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Une erreur est survenue',
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// ===== DÉMARRAGE DU SERVEUR =====

// Vérifier la connexion Firebase avant de démarrer
async function checkFirebaseConnection() {
    if (!firebaseInitialized) {
        console.error('❌ Firebase non initialisé');
        return false;
    }
    
    try {
        // Tester la connexion à la base de données
        await db.ref('.info/connected').once('value');
        console.log('✅ Connexion Firebase Database établie');
        
        // Tester l'authentification
        try {
            await auth.listUsers(1);
            console.log('✅ Connexion Firebase Auth établie');
        } catch (authError) {
            console.warn('⚠️ Firebase Auth peut avoir des permissions limitées:', authError.message);
        }
        
        return true;
    } catch (error) {
        console.error('❌ Erreur de connexion Firebase:', error.message);
        return false;
    }
}

// Démarrer le serveur
async function startServer() {
    const firebaseConnected = await checkFirebaseConnection();
    
    if (!firebaseConnected) {
        console.warn('⚠️ Démmarrage du serveur sans connexion Firebase complète');
    }
    
    app.listen(port, () => {
        console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🚀 Serveur PrixMatHaïti démarré avec succès        ║
║                                                       ║
║   📡 Port: ${port}${' '.repeat(43 - port.toString().length)}║
║   🌐 Environnement: ${process.env.NODE_ENV || 'development'}${' '.repeat(33 - (process.env.NODE_ENV || 'development').length)}║
║   🔥 Firebase: ${firebaseConnected ? '✅ Connecté' : '⚠️ Partiel'}${' '.repeat(40 - (firebaseConnected ? 'Connecté' : 'Partiel').length)}║
║                                                       ║
║   📍 API disponible sur:                              ║
║   http://localhost:${port}/api${' '.repeat(55 - port.toString().length)}║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
        `);
        
        console.log('\n📋 Endpoints disponibles:');
        console.log('├── GET  /api/health          - Vérification du serveur');
        console.log('├── GET  /api/info            - Informations sur l\'API');
        console.log('├── GET  /api/check-roles     - Vérifier les rôles utilisateur');
        console.log('├── GET  /api/check-supplier  - Vérifier statut fournisseur');
        console.log('├── GET  /api/check-admin     - Vérifier statut admin');
        console.log('├── GET  /api/user/profile    - Profil utilisateur');
        console.log('└── PUT  /api/user/update     - Mettre à jour le profil');
        
        if (firebaseConnected) {
            console.log('\n✅ Serveur prêt à recevoir des requêtes');
        } else {
            console.log('\n⚠️  Serveur démarré avec des limitations Firebase');
        }
    });
}

startServer().catch(error => {
    console.error('❌ Erreur critique lors du démarrage du serveur:', error);
    process.exit(1);
});

// Gestion propre de l'arrêt
process.on('SIGTERM', () => {
    console.log('👋 Arrêt du serveur...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('👋 Arrêt du serveur (Ctrl+C)...');
    process.exit(0);
});

// Exporter pour les tests
module.exports = { app, db, auth };
