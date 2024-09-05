// Firebase 配置
const firebaseConfig = {
    apiKey: "AIzaSyDDEOqfcwmJiti_HZqOyri4qWUFWbtCUh0",
    authDomain: "popo-database.firebaseapp.com",
    projectId: "popo-database",
    storageBucket: "popo-database.appspot.com",
    messagingSenderId: "825813869113",
    appId: "1:825813869113:web:90d32426d03df5cb30a3e8"
};

// 初始化 Firebase
firebase.initializeApp(firebaseConfig);

// 初始化 Firestore
const db = firebase.firestore();