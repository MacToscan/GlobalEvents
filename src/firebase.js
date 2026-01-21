// src/firebase.js

// 1. Importamos las herramientas de Firebase
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // <-- Importamos la Base de Datos

// 2. Tu configuración (Las llaves de Global Events)
const firebaseConfig = {
  apiKey: "AIzaSyBssdcmkFRY1tCFGp6fThbBgDjblUb_MPI",
  authDomain: "global-events-23a23.firebaseapp.com",
  projectId: "global-events-23a23",
  storageBucket: "global-events-23a23.firebasestorage.app",
  messagingSenderId: "432956551843",
  appId: "1:432956551843:web:77cc881d5a206f84ba8516"
};

// 3. Inicializar Firebase (Arrancar la app)
const app = initializeApp(firebaseConfig);

// 4. Inicializar la Base de Datos y EXPORTARLA para usarla en otros archivos
const db = getFirestore(app);

export { db };