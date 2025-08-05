
const firebaseConfig = {
  apiKey: "AIzaSyCGMcrDszDaktX6fXDpaT4Fx8k12N9RuCM",
  authDomain: "geoguesser-84d8b.firebaseapp.com",
  databaseURL: "https://geoguesser-84d8b-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "geoguesser-84d8b",
  storageBucket: "geoguesser-84d8b.appspot.com",
  messagingSenderId: "692484269477",
  appId: "1:692484269477:web:65decb37c4f2f72ec5b44c",
  measurementId: "G-4R2TWB4MNM"
};


firebase.initializeApp(firebaseConfig);


export const db = firebase.database();
export const auth = firebase.auth();
export const ADMIN_EMAIL = "duyga154@gmail.com";