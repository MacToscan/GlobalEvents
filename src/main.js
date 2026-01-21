import '../styles/main.scss';
// IMPORTANTE: Importamos la base de datos y las funciones de Firebase
import { db } from './firebase.js';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";

// ==========================================
// 🛡️ SEGURIDAD: EL PORTERO VIRTUAL
// ==========================================
// Esto se ejecuta ANTES de cargar nada más.
// Si alguien intenta entrar a 'admin.html' sin el "ticket" (session), lo echamos fuera.
if (window.location.pathname.includes('admin.html')) {
    const session = localStorage.getItem('ge_session_token');
    if (session !== 'active') {
        // Si no hay ticket, patada al login
        window.location.href = 'login.html';
    }
}

// ==========================================
// 0. MENÚ MÓVIL
// ==========================================
const menuToggle = document.querySelector('.header__toggle');
const menuNav = document.querySelector('.header__nav');

if (menuToggle && menuNav) {
  menuToggle.addEventListener('click', () => {
    menuNav.classList.toggle('is-active');
    menuToggle.textContent = menuNav.classList.contains('is-active') ? '✕' : '☰';
  });
  document.querySelectorAll('.header__menu a').forEach(link => {
    link.addEventListener('click', () => {
      menuNav.classList.remove('is-active');
      menuToggle.textContent = '☰';
    });
  });
}

// =========================================================
// 1. GESTIÓN DE DATOS Y MIGRACIÓN
// =========================================================

// =========================================================
// 1. GESTIÓN DE DATOS (CONECTADO A FIREBASE ☁️)
// =========================================================

// Iniciamos la lista vacía. Se llenará cuando Google responda.
let artistsData = []; 

async function loadArtistsFromCloud() {
    try {
      const querySnapshot = await getDocs(collection(db, "artists"));
      artistsData = []; 
      
      querySnapshot.forEach((doc) => {
          artistsData.push({ 
              id: doc.id, 
              ...doc.data() 
          });
      });

      artistsData.sort((a, b) => (a.order || 999) - (b.order || 999));
  
      console.log("📡 Datos descargados de la nube:", artistsData.length);
      refreshAllViews(); // Pinta la home y el admin
      
      // 👇 ¡AÑADE ESTA LÍNEA AQUÍ! 👇
      // Esto hace que, una vez tenemos datos, se rellene la ficha del artista
      loadArtistProfile(); 
  
    } catch (error) {
      console.error("❌ Error al descargar datos:", error);
      alert("Error de conexión con la base de datos");
    }
  }

// Esta función antes guardaba en localStorage. 
// Ahora la dejamos vacía o "tonta" de momento para que no rompa el código antiguo
// hasta que migremos el borrado y la edición.
function saveToStorage() {
  console.log("⚠️ saveToStorage ya no se usa. Los cambios deben ir a Firebase.");
  // refreshAllViews(); // Ya no hace falta refrescar aquí
}

function refreshAllViews() {
  populateCategories();
  
  // FILTRO: Solo destacados para la home y el editor de portada
  const featuredArtists = artistsData.filter(a => a.isFeatured);
  
  renderHomeArtists(featuredArtists); 
  renderHomeEditor(featuredArtists); 
  renderAdminList(artistsData);      
}

// ==========================================
// 2. LÓGICA HOME (WEB PÚBLICA)
// ==========================================
const gridContainer = document.getElementById('artist-grid-container');
const searchInput = document.getElementById('search-name');
const searchCat = document.getElementById('search-category');
const searchBtn = document.querySelector('.search-bar__btn');
const suggestionsBox = document.getElementById('custom-suggestions');

function populateCategories() {
  const cats = [...new Set(artistsData.map(a => a.category))];
  const options = cats.map(c => `<option value="${c}">${c}</option>`).join('');
  
  if (searchCat) searchCat.innerHTML = `<option value="">Todas</option>${options}`;
  if (document.getElementById('cat-suggestions')) document.getElementById('cat-suggestions').innerHTML = options;
  if (document.getElementById('admin-category-filter')) document.getElementById('admin-category-filter').innerHTML = `<option value="all">Todas las categorías</option>${options}`;
}

function renderHomeArtists(list) {
  if (!gridContainer) return;
  if (list.length === 0) {
      gridContainer.innerHTML = '<p style="color:white; width:100%; text-align:center; padding: 50px;">Aún no hay artistas destacados en portada.</p>';
      return;
  }
  gridContainer.innerHTML = list.map(artist => `
    <article class="card">
      <div class="card__img-wrapper">
        <img src="${artist.images[0]}" alt="${artist.name}" class="card__image" loading="lazy">
      </div>
      <div class="card__content">
        ${ artist.homeDescription 
           ? `<p style="color:#BF953F; font-size:0.9rem; margin-bottom:5px; font-style:italic;">"${artist.homeDescription}"</p>` 
           : `<span class="card__category">${artist.category}</span>` 
        }
        <h3 class="card__title">${artist.name}</h3>
        <p class="card__zone">📍 ${artist.zone}</p>
        <a href="/artist.html?id=${artist.id}" class="btn btn--gold" style="margin-top: 20px;">Ver Ficha</a>
      </div>
    </article>
  `).join('');
}

function executeSearch() {
    const nameVal = searchInput.value.toLowerCase();
    const catVal = searchCat.value;
    const filtered = artistsData.filter(a => a.name.toLowerCase().includes(nameVal) && (catVal === "" || a.category === catVal));
    const featuredFiltered = filtered.filter(a => a.isFeatured);
    renderHomeArtists(featuredFiltered);
    
    if (suggestionsBox) suggestionsBox.style.display = 'none';
    if (gridContainer) setTimeout(() => gridContainer.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

if(searchBtn) searchBtn.addEventListener('click', executeSearch);
if(searchInput) {
    searchInput.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase().trim();
        suggestionsBox.innerHTML = ''; 
        if (!val) { suggestionsBox.style.display = 'none'; searchInput.classList.remove('open'); return; }
        const matches = artistsData.filter(a => a.name.toLowerCase().includes(val));
        if (matches.length > 0) {
            matches.forEach(artist => {
                const li = document.createElement('li');
                li.innerHTML = artist.name;
                li.addEventListener('click', () => { searchInput.value = artist.name; executeSearch(); });
                suggestionsBox.appendChild(li);
            });
            suggestionsBox.style.display = 'block'; searchInput.classList.add('open');
        } else { suggestionsBox.style.display = 'none'; }
    });
    document.addEventListener('click', (e) => { if (!searchInput.contains(e.target) && !suggestionsBox.contains(e.target)) suggestionsBox.style.display = 'none'; });
}

// ==========================================
// 3. FICHA ARTISTA
// ==========================================
function loadArtistProfile() {
    const profileName = document.getElementById('profile-name');
    if (!profileName) return; 

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const artist = artistsData.find(a => a.id == id);

    if (artist) {
        document.title = `${artist.name} | Global Events`;
        profileName.textContent = artist.name;
        document.getElementById('profile-category').textContent = artist.category;
        document.getElementById('profile-desc').innerText = artist.description || "Sin descripción.";
        document.getElementById('profile-zone').textContent = artist.zone;
        if(document.getElementById('sidebar-category')) document.getElementById('sidebar-category').textContent = artist.category;

        const links = document.getElementById('social-links-container');
        links.innerHTML = '';
        const s = artist.socials || {};
        if (s.instagram) links.innerHTML += `<a href="${s.instagram}" target="_blank" class="link-item"><i class="fa-brands fa-instagram"></i> Instagram</a>`;
        if (s.facebook) links.innerHTML += `<a href="${s.facebook}" target="_blank" class="link-item"><i class="fa-brands fa-facebook"></i> Facebook</a>`;
        if (s.website) links.innerHTML += `<a href="${s.website}" target="_blank" class="link-item"><i class="fa-solid fa-globe"></i> Web</a>`;
        if (s.youtube) links.innerHTML += `<a href="${s.youtube}" target="_blank" class="link-item"><i class="fa-brands fa-youtube"></i> Video</a>`;

        const track = document.getElementById('slider-track');
        track.innerHTML = '';
        if(artist.images && artist.images.length > 0) {
            artist.images.forEach((imgUrl, index) => {
                const slide = document.createElement('div');
                slide.className = `slide ${index === 0 ? 'is-active' : ''}`;
                slide.innerHTML = `<img src="${imgUrl}" alt="${artist.name}">`;
                track.appendChild(slide);
            });
        }
        initProfileSlider();
    }
}
function initProfileSlider() {
    const slides = document.querySelectorAll('.artist-gallery .slide');
    const prevBtn = document.getElementById('btn-prev');
    const nextBtn = document.getElementById('btn-next');
    if (slides.length <= 1) { 
        if(prevBtn) prevBtn.style.display = 'none'; 
        if(nextBtn) nextBtn.style.display = 'none'; 
        return; 
    } else {
        if(prevBtn) prevBtn.style.display = 'block'; 
        if(nextBtn) nextBtn.style.display = 'block'; 
    }
    let currentSlide = 0;
    const showSlide = (n) => {
        slides.forEach(s => s.classList.remove('is-active'));
        currentSlide = (n + slides.length) % slides.length;
        slides[currentSlide].classList.add('is-active');
    };
    if(prevBtn) prevBtn.addEventListener('click', () => showSlide(currentSlide - 1));
    if(nextBtn) nextBtn.addEventListener('click', () => showSlide(currentSlide + 1));
}


// ==========================================
// 4. ADMIN: GESTIÓN DE ESTRELLAS Y LISTAS
// ==========================================

window.toggleFeatured = async (id) => {
    // 1. Buscamos el artista en memoria
    const artist = artistsData.find(a => a.id === id);
    if (!artist) return;

    // 2. Control de límite (máximo 6)
    const currentFeaturedCount = artistsData.filter(a => a.isFeatured).length;
    if (!artist.isFeatured && currentFeaturedCount >= 6) {
        alert("⚠️ ¡Límite alcanzado! Solo puedes tener 6 en portada.");
        return;
    }

    try {
        // 3. CAMBIAMOS EL ESTADO EN LA NUBE ☁️
        const newStatus = !artist.isFeatured;
        
        // Referencia al documento en Firestore
        const artistRef = doc(db, "artists", id);
        
        // Actualizamos solo el campo 'isFeatured'
        await updateDoc(artistRef, {
            isFeatured: newStatus
        });

        console.log("⭐️ Estado actualizado en Firebase");
        loadArtistsFromCloud(); // Recargamos para ver el cambio

    } catch (error) {
        console.error("Error al actualizar estrella:", error);
        alert("No se pudo cambiar el estado destacado.");
    }
};

function renderAdminList(list) {
    const container = document.getElementById('admin-artist-list');
    if (!container) return;
    
    container.innerHTML = list.map((artist) => {
      const starClass = artist.isFeatured ? "fa-solid fa-star" : "fa-regular fa-star";
      const starColor = artist.isFeatured ? "color: gold;" : "color: gray;";
      const featuredLabel = artist.isFeatured ? '<span style="color:#FFD700; font-size:0.7rem; display:block;">★ EN PORTADA</span>' : '';

      return `
      <article class="admin-card">
        <img src="${artist.images[0]}" class="admin-card__thumb">
        <div class="admin-card__info">
            <h3>${artist.name}</h3>
            ${featuredLabel}
            <p>${artist.category}</p>
        </div>
        <div class="admin-card__actions">
          <button onclick="window.toggleFeatured('${artist.id}')" style="background:none; border:none; font-size:1.2rem; cursor:pointer; margin-right:10px;">
            <i class="${starClass}" style="${starColor}"></i>
          </button>
          <button onclick="window.openEditModal('${artist.id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-delete" onclick="window.deleteArtist('${artist.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </article>
    `}).join('');
}


// ==========================================
// 5. EDITOR DE PORTADA CON DRAG & DROP
// ==========================================

function renderHomeEditor(list) {
    const container = document.getElementById('home-artist-list');
    if (!container) return;
    
    if(list.length === 0) {
        container.innerHTML = "<p style='color:#666; width:100%; text-align:center;'>No hay artistas seleccionados</p>";
        return;
    }

    // AÑADIMOS data-id para poder arrastrar
    container.innerHTML = list.map((artist, index) => `
      <div class="home-edit-card" data-id="${artist.id}">
         <div class="pos-badge">POS ${index + 1}</div>
         <img src="${artist.images[0]}">
         <div class="info">
            <h4>${artist.name}</h4>
            <span style="font-size:0.8rem; color:#aaa;">"${artist.homeDescription || 'Sin frase'}"</span>
         </div>
         <button class="btn-edit-mini" onclick="window.openHomeEditModal('${artist.id}')">
            <i class="fa-solid fa-image"></i> EDITAR PORTADA
         </button>
      </div>
    `).join('');

    // Iniciamos la lógica de arrastrar
    initSortable();
}

function initSortable() {
    const el = document.getElementById('home-artist-list');
    if (!el || typeof Sortable === 'undefined') return;

    if (el._sortable) el._sortable.destroy();

    el._sortable = new Sortable(el, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        delay: 0, // ⚡️ HE PUESTO 0: Arrastra al instante (antes era 200)
        delayOnTouchOnly: true, 
        
        // Cuando terminas de arrastrar...
        onEnd: async function (evt) {
            // 1. Miramos el nuevo orden visual en la pantalla
            const itemEls = el.querySelectorAll('.home-edit-card');
            
            // ⚠️ CORRECCIÓN CLAVE: Quitamos 'parseInt' porque los IDs ahora son letras
            const newOrderIds = Array.from(itemEls).map(item => item.getAttribute('data-id'));

            // 2. Feedback visual inmediato (actualizamos las etiquetas POS 1, POS 2...)
            itemEls.forEach((item, index) => {
                const badge = item.querySelector('.pos-badge');
                if(badge) badge.textContent = `POS ${index + 1}`;
            });

            // 3. ☁️ GUARDAR EN GOOGLE (La Magia)
            // Recorremos la lista y le decimos a Google: "Tú eres el 0, tú el 1, tú el 2..."
            try {
                const updates = newOrderIds.map((id, index) => {
                    const docRef = doc(db, "artists", id);
                    return updateDoc(docRef, { order: index }); // Guardamos el campo 'order'
                });

                // Esperamos a que todos se guarden
                await Promise.all(updates);
                console.log("✅ Orden actualizado en la nube");
                
                // Actualizamos nuestra memoria local también para no tener que recargar
                // (Truco para que se sienta rápido)
                newOrderIds.forEach((id, index) => {
                    const a = artistsData.find(x => x.id === id);
                    if(a) a.order = index;
                });
                artistsData.sort((a, b) => (a.order || 0) - (b.order || 0));

            } catch (error) {
                console.error("Error al guardar orden:", error);
                alert("Hubo un error al guardar el orden. Recarga la página.");
            }
        }
    });
}


// ==========================================
// 6. MODAL PORTADA
// ==========================================
const homeModal = document.getElementById('home-edit-modal');
const homeForm = document.getElementById('home-edit-form');
let tempSelectedCoverIndex = 0;

window.openHomeEditModal = (id) => {
    const artist = artistsData.find(a => a.id === id);
    if (!artist) return;

    document.getElementById('home-edit-id').value = artist.id;
    document.getElementById('home-artist-name').textContent = artist.name;
    document.getElementById('home-artist-cat').textContent = artist.category;
    document.getElementById('home-edit-desc').value = artist.homeDescription || "";

    tempSelectedCoverIndex = 0; 
    renderCoverSelector(artist.images);
    homeModal.classList.add('is-visible');
};

function renderCoverSelector(images) {
    const container = document.getElementById('cover-selector-container');
    container.innerHTML = images.map((img, index) => {
        const isSelected = (index === tempSelectedCoverIndex) ? 'is-selected' : '';
        return `
            <div class="cover-option ${isSelected}" onclick="selectCoverImage(${index})">
                <img src="${img}">
            </div>
        `;
    }).join('');
}

window.selectCoverImage = (index) => {
    tempSelectedCoverIndex = index;
    const artistId = document.getElementById('home-edit-id').value;
    const artist = artistsData.find(a => a.id == artistId);
    renderCoverSelector(artist.images);
};

if (homeForm) {
    homeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // 1. Recogemos los datos del formulario
        const id = document.getElementById('home-edit-id').value;
        const newDesc = document.getElementById('home-edit-desc').value;
        const btnSubmit = homeForm.querySelector('button[type="submit"]');

        // Buscamos al artista en memoria para manipular sus fotos
        const idx = artistsData.findIndex(a => a.id == id);
        if (idx === -1) return;

        let artist = artistsData[idx];
        let updatedImages = [...artist.images]; // Copia de las fotos actuales

        // Si eligió una foto nueva para portada, la movemos a la posición 0
        if (tempSelectedCoverIndex > 0) {
            const selectedImage = updatedImages[tempSelectedCoverIndex];
            updatedImages.splice(tempSelectedCoverIndex, 1); // La quitamos de donde esté
            updatedImages.unshift(selectedImage); // La ponemos primera
        }

        // 2. ENVIAMOS A GOOGLE ☁️
        btnSubmit.textContent = "Guardando...";
        btnSubmit.disabled = true;

        try {
            const artistRef = doc(db, "artists", id);
            
            await updateDoc(artistRef, {
                homeDescription: newDesc, // Guardamos la frase
                images: updatedImages     // Guardamos el nuevo orden de fotos
            });

            console.log("✅ Portada actualizada en la nube");
            loadArtistsFromCloud(); // Recargamos la web
            homeModal.classList.remove('is-visible');

        } catch (error) {
            console.error("Error al actualizar portada:", error);
            alert("Error: " + error.message);
        } finally {
            btnSubmit.textContent = "Guardar Portada";
            btnSubmit.disabled = false;
        }
    });
}


// ==========================================
// 7. EDICIÓN FICHA COMPLETA
// ==========================================
const modal = document.getElementById('artist-modal');
const form = document.getElementById('artist-form');
let currentGallery = [];

const btnToggleHome = document.getElementById('btn-toggle-home-editor');
const homePanel = document.getElementById('home-editor-panel');
if (btnToggleHome) {
    btnToggleHome.addEventListener('click', () => {
        homePanel.classList.toggle('hidden');
    });
}

window.removeImageFromGallery = (idx) => { currentGallery.splice(idx,1); renderGalleryPreview(); };
const multiFile = document.getElementById('multi-file-input');
if(multiFile) multiFile.addEventListener('change', function(){
    Array.from(this.files).forEach(f => {
        const r = new FileReader();
        r.onload = e => { currentGallery.push(e.target.result); renderGalleryPreview(); };
        r.readAsDataURL(f);
    });
});
function renderGalleryPreview() {
    const box = document.getElementById('gallery-preview-container');
    box.innerHTML = currentGallery.map((src,i) => 
        `<div class="gallery-item"><img src="${src}"><button type="button" class="btn-remove-img" onclick="window.removeImageFromGallery(${i})">✕</button></div>`
    ).join('');
}

window.openEditModal = (id) => {
    const artist = artistsData.find(a => a.id === id);
    if (!artist) return;
    
    document.getElementById('modal-title').textContent = "Modificar Ficha";
    document.getElementById('artist-id').value = artist.id;
    document.getElementById('artist-name').value = artist.name;
    document.getElementById('artist-category').value = artist.category;
    document.getElementById('artist-zone').value = artist.zone;
    document.getElementById('description').value = artist.description || "";
    
    const s = artist.socials || {};
    document.getElementById('social-instagram').value = s.instagram || "";
    document.getElementById('social-facebook').value = s.facebook || "";
    document.getElementById('social-website').value = s.website || "";
    document.getElementById('social-youtube').value = s.youtube || "";

    currentGallery = [...artist.images];
    renderGalleryPreview();
    modal.classList.add('is-visible');
};

const btnAdd = document.getElementById('add-artist-btn');
if (btnAdd) {
    btnAdd.addEventListener('click', () => {
        form.reset();
        document.getElementById('artist-id').value = ""; 
        currentGallery = [];
        renderGalleryPreview();
        document.getElementById('modal-title').textContent = "Añadir Nuevo Artista";
        modal.classList.add('is-visible');
    });
}

// ==========================================
// NUEVO SISTEMA DE GUARDADO (FIREBASE CLOUD ☁️)
// ==========================================
if (form) {
    form.addEventListener('submit', async (e) => { // ⚠️ Nota el 'async' aquí
        e.preventDefault();

        // 1. Feedback visual (Para que sepa que está pensando)
        const btnSubmit = form.querySelector('button[type="submit"]');
        const originalText = btnSubmit.textContent;
        btnSubmit.textContent = "Subiendo a la nube...";
        btnSubmit.disabled = true;

        // 2. Preparar los datos
        const id = document.getElementById('artist-id').value;
        if (currentGallery.length === 0) currentGallery.push("https://via.placeholder.com/400?text=Sin+Foto");

        const toTitleCase = (str) => {
            return str.replace(/\w\S*/g, (txt) => {
                return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
            });
        };

       const artistData = {
            // ⚠️ AQUÍ ESTABA EL FALLO: Faltaba usar la función 'toTitleCase(...)'
            name: toTitleCase(document.getElementById('artist-name').value),
            category: toTitleCase(document.getElementById('artist-category').value),
            zone: toTitleCase(document.getElementById('artist-zone').value),
            
            description: document.getElementById('description').value, // Este NO se toca (queremos libertad)
            images: currentGallery,
            // Estos campos son obligatorios para que no falle la web luego
            isFeatured: false, 
            homeDescription: "",
            socials: {
                instagram: document.getElementById('social-instagram').value,
                facebook: document.getElementById('social-facebook').value,
                website: document.getElementById('social-website').value,
                youtube: document.getElementById('social-youtube').value,
            }
        };

        try {
            if (id) {
                // --- MODO EDITAR (Lo activaremos luego) ---
                // De momento, como estamos migrando, no editaremos los viejos del localStorage
                alert("⚠️ Estamos en transición a la nube. Por ahora, prueba a crear un artista NUEVO.");
            } else {
                // --- MODO CREAR (NUEVO) ☁️ ---
                // Aquí ocurre la magia: 'addDoc' envía los datos a Google
                const docRef = await addDoc(collection(db, "artists"), artistData);
                console.log("✅ Artista guardado en Firestore con ID: ", docRef.id);
                alert("¡Artista guardado en la nube correctamente!");
                loadArtistsFromCloud(); // <--- AÑADE ESTA LÍNEA MÁGICA ✨
            }

            // Cerrar y limpiar
            modal.classList.remove('is-visible');
            form.reset();
            currentGallery = [];
            
            // ⚠️ OJO: La lista de atrás NO se actualizará sola todavía 
            // porque sigue leyendo del localStorage.
            // Eso lo arreglaremos en el siguiente paso (Lectura).
            
        } catch (error) {
            console.error("❌ Error al guardar en Firebase:", error);
            alert("Hubo un error: " + error.message);
        } finally {
            // Restaurar botón
            btnSubmit.textContent = originalText;
            btnSubmit.disabled = false;
        }
    });
}

document.querySelectorAll('.modal__close, #cancel-modal, #cancel-home-modal').forEach(btn => 
    btn.addEventListener('click', () => {
        modal.classList.remove('is-visible');
        homeModal.classList.remove('is-visible');
    })
);

window.deleteArtist = async (id) => {
    if (!confirm('¿Seguro que quieres borrar este artista de la nube?')) return;

    try {
        // 1. Borramos el documento en Google usando su ID
        await deleteDoc(doc(db, "artists", id));
        
        console.log("🗑️ Artista eliminado de Firestore");
        
        // 2. Recargamos la lista para que desaparezca de la pantalla
        loadArtistsFromCloud();
        alert("¡Artista eliminado correctamente!");

    } catch (error) {
        console.error("Error al borrar:", error);
        alert("No se pudo borrar: " + error.message);
    }
};

if (document.getElementById('admin-search')) {
    document.getElementById('admin-search').addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        const filtered = artistsData.filter(a => a.name.toLowerCase().includes(val));
        renderAdminList(filtered);
    });
}


// ==========================================
// 8. LOGIN Y LOGOUT (CON SEGURIDAD)
// ==========================================

if (document.getElementById('login-form')) {
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const pass = document.getElementById('password').value;

        if (email === 'admin@globalevents.com' && pass === 'admin123') {
            // ✅ LOGIN CORRECTO: DAMOS EL "TICKET"
            localStorage.setItem('ge_session_token', 'active');
            window.location.href = 'admin.html';
        } else { 
            alert('Incorrecto'); 
        }
    });
}

window.logout = () => { 
    if(confirm('¿Salir?')) {
        // ❌ LOGOUT: ROMPEMOS EL "TICKET"
        localStorage.removeItem('ge_session_token');
        window.location.href = 'login.html';
    } 
};

// ==========================================
// 9. SEGURIDAD CONTACTO (HONEYPOT ANTI-BOTS)
// ==========================================

const contactForm = document.getElementById('contact-form');

if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault(); // Paramos el envío un momento

        // 1. COMPROBACIÓN DE SEGURIDAD
        const trap = document.getElementById('honeypot-field');
        
        // Si el campo trampa tiene algo escrito... ¡ES UN ROBOT! 🤖
        if (trap && trap.value !== "") {
            console.warn('Bot detectado. Envío bloqueado.');
            return; // Cortamos aquí. No se envía nada.
        }

        // 2. SIMULACIÓN DE ENVÍO (Para Roxana)
        // Aquí iría tu código real de envío (Formspree, EmailJS, etc.)
        const btn = contactForm.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        
        btn.textContent = 'Enviando...';
        btn.style.opacity = '0.7';
        btn.disabled = true;

        setTimeout(() => {
            alert('¡Mensaje enviado correctamente! Gracias por contactar.');
            contactForm.reset(); // Limpiamos el formulario
            btn.textContent = originalText;
            btn.style.opacity = '1';
            btn.disabled = false;
        }, 1500);
    });
}

// INICIO
// 1. Primero intentamos cargar perfil (si estamos en artist.html)
loadArtistProfile();

// 2. Y lanzamos la petición a la nube para llenar las listas
loadArtistsFromCloud(); 

console.log('App Ready: CLOUD VERSION ☁️');