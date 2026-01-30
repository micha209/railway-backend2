const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialiser Firebase Admin SDK
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.database();

// Middleware d'authentification
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Non autorisé' });
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email
    };
    
    next();
  } catch (error) {
    console.error('Erreur d\'authentification:', error);
    res.status(401).json({ error: 'Token invalide' });
  }
};

// 1. Vérifier si l'utilisateur est un fournisseur
app.get('/api/check-supplier', authenticateUser, async (req, res) => {
  try {
    const user = req.user;
    
    console.log('Vérification du statut fournisseur pour:', user.email, user.uid);
    
    const suppliersRef = db.ref('fournisseur');
    const snapshot = await suppliersRef.once('value');
    const suppliers = snapshot.val();
    
    if (!suppliers) {
      console.log('Aucun fournisseur trouvé dans la base de données');
      return res.json({ isSupplier: false });
    }
    
    let isSupplier = false;
    
    for (const supplierId in suppliers) {
      const supplier = suppliers[supplierId];
      
      console.log('Fournisseur trouvé:', supplier);
      
      if (supplier.email === user.email || supplier.id === user.uid) {
        console.log('Utilisateur reconnu comme fournisseur');
        isSupplier = true;
        break;
      }
    }
    
    console.log('Résultat de vérification:', isSupplier ? 'Fournisseur' : 'Non fournisseur');
    
    res.json({ isSupplier });
  } catch (error) {
    console.error('Erreur lors de la vérification du statut fournisseur:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// 2. Vérifier si l'utilisateur est un admin
app.get('/api/check-admin', authenticateUser, async (req, res) => {
  try {
    const user = req.user;
    
    const adminRef = db.ref('admin');
    const snapshot = await adminRef.orderByChild('email').equalTo(user.email).once('value');
    const adminData = snapshot.val();
    
    const isAdmin = adminData !== null;
    
    res.json({ isAdmin });
  } catch (error) {
    console.error('Erreur lors de la vérification du statut admin:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// 3. Vérifier les rôles combinés
app.get('/api/check-roles', authenticateUser, async (req, res) => {
  try {
    const user = req.user;
    
    // Vérifier le statut fournisseur
    const suppliersRef = db.ref('fournisseur');
    const suppliersSnapshot = await suppliersRef.once('value');
    const suppliers = suppliersSnapshot.val();
    
    let isSupplier = false;
    if (suppliers) {
      for (const supplierId in suppliers) {
        const supplier = suppliers[supplierId];
        if (supplier.email === user.email || supplier.id === user.uid) {
          isSupplier = true;
          break;
        }
      }
    }
    
    // Vérifier le statut admin
    const adminRef = db.ref('admin');
    const adminSnapshot = await adminRef.orderByChild('email').equalTo(user.email).once('value');
    const adminData = adminSnapshot.val();
    const isAdmin = adminData !== null;
    
    res.json({
      isSupplier,
      isAdmin,
      user: {
        uid: user.uid,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Erreur lors de la vérification des rôles:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Route de santé
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Démarrer le serveur
app.listen(port, () => {
  console.log(`🚀 Serveur backend démarré sur le port ${port}`);
  console.log(`📡 API disponible sur http://localhost:${port}/api`);
});
