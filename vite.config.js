import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',     // Tu portada
        admin: 'admin.html',    // Tu panel
        artist: 'artist.html',  // La ficha
        contact: 'contact.html', // La página de contacto
        about: 'about.html',
        login: 'login.html',
        events: 'events.html'
      }
    }
  }
});