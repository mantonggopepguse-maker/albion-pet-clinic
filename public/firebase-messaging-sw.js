/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: 'AIzaSyAUTbRdTz1oQeaOl17shdpndyF3ieVZDV4',
    authDomain: 'albionos.firebaseapp.com',
    projectId: 'albionos',
    storageBucket: 'albionos.firebasestorage.app',
    messagingSenderId: '682667219332',
    appId: '1:682667219332:web:08ca2a09315c37ce6c25d1',
    measurementId: 'G-B6EBCTCHLY',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    const notification = payload.notification || {};
    const title = notification.title || 'Vet Nexus';
    const options = {
        body: notification.body || 'You have a new notification.',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        data: payload.data || {},
    };

    self.registration.showNotification(title, options);
});
