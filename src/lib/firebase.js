import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

// const firebaseConfig = {
// 	apiKey: import.meta.env.VITE_API_KEY,
// 	authDomain: 'reactchat-4d1a6.firebaseapp.com',
// 	projectId: 'reactchat-4d1a6',
// 	storageBucket: 'reactchat-4d1a6.firebasestorage.app',
// 	messagingSenderId: '621918966332',
// 	appId: '1:621918966332:web:352b684a93dd9c42d72939',
// }

const firebaseConfig = {
	apiKey: 'AIzaSyBHedTqQer5Kbt7BrEwqSm5us1JaF19QWI',
	authDomain: 'food-app-5cbe7.firebaseapp.com',
	databaseURL: 'https://food-app-5cbe7-default-rtdb.firebaseio.com',
	projectId: 'food-app-5cbe7',
	storageBucket: 'food-app-5cbe7.appspot.com',
	messagingSenderId: '829389162673',
	appId: '1:829389162673:web:88a20e6434e1f029b87a90',
	measurementId: 'G-Q7KFEJ7QNQ',
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

export const auth = getAuth()
export const db = getFirestore()
export const storage = getStorage()
