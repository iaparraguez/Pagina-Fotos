import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, query, where, doc, setDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { Camera, Home, Image as ImageIcon, Info, Mail, User, LogIn, LogOut, PlusCircle, Trash2, UploadCloud, XCircle, Eye, EyeOff, Instagram, ArrowLeft } from 'lucide-react';

// --- Firebase Configuration ---
// NOTE: Replace with your actual Firebase config
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// --- App ID (for Firestore paths) ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'louis-photography-website';

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// For debugging Firestore:
// import { setLogLevel } from "firebase/firestore";
// setLogLevel('debug');


// --- Main App Component ---
function App() {
  const [currentPage, setCurrentPage] = useState('home'); // home, albums, album_detail, about, admin_login, admin_panel
  const [selectedAlbumId, setSelectedAlbumId] = useState(null);
  const [albums, setAlbums] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [notification, setNotification] = useState({ message: '', type: '' }); // type: 'success' or 'error'

  // --- Firebase Auth State Listener ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        // Simple check for admin status (for demo purposes)
        // In a real app, you'd check a custom claim or a Firestore document
        if (user.uid === localStorage.getItem('louisPhotoAdminUID')) {
            setIsAdmin(true);
        }
      } else {
        // If __initial_auth_token is not defined, sign in anonymously
        try {
            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                await signInWithCustomToken(auth, __initial_auth_token);
            } else {
                await signInAnonymously(auth);
            }
        } catch (error) {
            console.error("Error during sign-in:", error);
            showNotification(`Error signing in: ${error.message}`, 'error');
        }
        setUserId(null);
        setIsAdmin(false);
      }
      setAuthReady(true);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- Show Notification ---
  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification({ message: '', type: '' });
    }, 3000);
  };

  // --- Fetch Albums ---
  useEffect(() => {
    if (!authReady) return; // Wait for auth to be ready

    setIsLoading(true);
    const albumsCollectionRef = collection(db, `artifacts/${appId}/public/data/albums`);
    const unsubscribe = onSnapshot(albumsCollectionRef, (snapshot) => {
      const albumsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAlbums(albumsData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching albums:", error);
      showNotification(`Error fetching albums: ${error.message}`, 'error');
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [authReady]);

  // --- Fetch Photos for Selected Album ---
  useEffect(() => {
    if (!authReady || !selectedAlbumId) {
      setPhotos([]);
      return;
    }
    setIsLoading(true);
    const photosCollectionRef = collection(db, `artifacts/${appId}/public/data/photos`);
    const q = query(photosCollectionRef, where("albumId", "==", selectedAlbumId));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const photosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPhotos(photosData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching photos:", error);
      showNotification(`Error fetching photos for album ${selectedAlbumId}: ${error.message}`, 'error');
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [authReady, selectedAlbumId]);


  const navigateTo = (page, albumId = null) => {
    setCurrentPage(page);
    setSelectedAlbumId(albumId);
    window.scrollTo(0, 0); // Scroll to top on page change
  };

  const handleAdminLogin = (uid) => {
    // For demo, store a special UID. In real app, use custom claims or secure check.
    localStorage.setItem('louisPhotoAdminUID', uid);
    setUserId(uid); // Set current user ID
    setIsAdmin(true);
    navigateTo('admin_panel');
    showNotification('Admin login successful!', 'success');
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('louisPhotoAdminUID');
    setIsAdmin(false);
    // Potentially sign out from Firebase if it was a specific admin account
    // auth.signOut(); 
    navigateTo('home');
    showNotification('Logged out.', 'success');
  };

  // --- Render Page Content ---
  const renderContent = () => {
    if (isLoading && !authReady) {
      return <div className="flex justify-center items-center h-screen text-white"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-rose-500"></div></div>;
    }
    switch (currentPage) {
      case 'home':
        return (
          <>
            <HeroSection photographerName="Louis" onNavigate={() => navigateTo('albums')} />
            <AlbumGallery albums={albums} onNavigate={navigateTo} isLoading={isLoading} />
          </>
        );
      case 'albums':
        return <AlbumGallery albums={albums} onNavigate={navigateTo} isLoading={isLoading} isPage={true} />;
      case 'album_detail':
        const currentAlbum = albums.find(album => album.id === selectedAlbumId);
        return <AlbumPage album={currentAlbum} photos={photos} onNavigate={navigateTo} isLoading={isLoading} />;
      case 'about':
        return <AboutPage />;
      case 'admin_login':
        return <AdminLogin onLogin={handleAdminLogin} />;
      case 'admin_panel':
        if (!isAdmin) {
          navigateTo('admin_login');
          return null;
        }
        return <AdminPanel albums={albums} showNotification={showNotification} currentUserId={userId} />;
      default:
        return <HeroSection photographerName="Louis" onNavigate={() => navigateTo('albums')} />;
    }
  };

  return (
    <div className="bg-gray-900 min-h-screen text-gray-100 font-sans antialiased">
      <Navbar onNavigate={navigateTo} isAdmin={isAdmin} onLogout={handleAdminLogout} />
      {notification.message && (
        <div className={`fixed top-20 right-5 p-4 rounded-md shadow-lg z-50 ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
          {notification.message}
        </div>
      )}
      <main className="pt-16"> {/* Adjust padding top to account for fixed navbar height */}
        {renderContent()}
      </main>
      <ContactSection />
      { userId && <div className="fixed bottom-2 left-2 text-xs text-gray-500 bg-gray-800 p-1 rounded">User ID: {userId}</div>}
    </div>
  );
}

// --- Navbar Component ---
const Navbar = ({ onNavigate, isAdmin, onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    { label: 'Home', page: 'home', icon: <Home size={18} /> },
    { label: 'Albums', page: 'albums', icon: <ImageIcon size={18} /> },
    { label: 'About', page: 'about', icon: <Info size={18} /> },
  ];

  return (
    <nav className="bg-gray-900/80 backdrop-blur-md shadow-lg fixed w-full top-0 z-40">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <button onClick={() => onNavigate('home')} className="flex-shrink-0 text-rose-500 hover:text-rose-400 transition duration-300">
              <Camera size={32} />
            </button>
            <span onClick={() => onNavigate('home')} className="ml-3 text-2xl font-semibold text-white cursor-pointer">Louis Photography</span>
          </div>
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {navItems.map(item => (
                <button
                  key={item.label}
                  onClick={() => onNavigate(item.page)}
                  className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition duration-300 flex items-center space-x-2"
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
              {isAdmin ? (
                <>
                  <button
                    onClick={() => onNavigate('admin_panel')}
                    className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition duration-300 flex items-center space-x-2"
                  >
                    <UploadCloud size={18} />
                    <span>Admin Panel</span>
                  </button>
                  <button
                    onClick={onLogout}
                    className="text-gray-300 bg-rose-600 hover:bg-rose-500 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition duration-300 flex items-center space-x-2"
                  >
                     <LogOut size={18} />
                    <span>Logout</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => onNavigate('admin_login')}
                  className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition duration-300 flex items-center space-x-2"
                >
                  <LogIn size={18} />
                  <span>Admin</span>
                </button>
              )}
            </div>
          </div>
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="text-gray-300 hover:text-white focus:outline-none p-2"
            >
              {menuOpen ? <XCircle size={24} /> : <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>}
            </button>
          </div>
        </div>
      </div>
      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden bg-gray-800">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {navItems.map(item => (
              <button
                key={item.label}
                onClick={() => { onNavigate(item.page); setMenuOpen(false); }}
                className="text-gray-300 hover:bg-gray-700 hover:text-white block w-full text-left px-3 py-2 rounded-md text-base font-medium transition duration-300 flex items-center space-x-2"
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
            {isAdmin ? (
              <>
                <button
                  onClick={() => { onNavigate('admin_panel'); setMenuOpen(false); }}
                  className="text-gray-300 hover:bg-gray-700 hover:text-white block w-full text-left px-3 py-2 rounded-md text-base font-medium transition duration-300 flex items-center space-x-2"
                >
                  <UploadCloud size={18} />
                  <span>Admin Panel</span>
                </button>
                <button
                  onClick={() => { onLogout(); setMenuOpen(false); }}
                  className="text-gray-300 bg-rose-600 hover:bg-rose-500 hover:text-white block w-full text-left px-3 py-2 rounded-md text-base font-medium transition duration-300 flex items-center space-x-2"
                >
                  <LogOut size={18} />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => { onNavigate('admin_login'); setMenuOpen(false); }}
                className="text-gray-300 hover:bg-gray-700 hover:text-white block w-full text-left px-3 py-2 rounded-md text-base font-medium transition duration-300 flex items-center space-x-2"
              >
                <LogIn size={18} />
                <span>Admin</span>
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

// --- Hero Section Component ---
const HeroSection = ({ photographerName, onNavigate }) => {
  // Placeholder image - replace with an actual stunning photo URL
  const heroImageUrl = "https://placehold.co/1920x1080/1A202C/4A5568?text=Louis's+Masterpiece";
  return (
    <section
      className="h-screen bg-cover bg-center flex items-center justify-center relative"
      style={{ backgroundImage: `url(${heroImageUrl})` }}
    >
      <div className="absolute inset-0 bg-black opacity-50"></div>
      <div className="relative z-10 text-center p-4">
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight">
          {photographerName}
        </h1>
        <p className="text-xl md:text-2xl text-gray-200 mb-8">
          Capturing Moments, Creating Memories
        </p>
        <button
          onClick={onNavigate}
          className="bg-rose-600 hover:bg-rose-500 text-white font-semibold py-3 px-8 rounded-lg text-lg transition duration-300 transform hover:scale-105 shadow-lg"
        >
          View Gallery
        </button>
      </div>
    </section>
  );
};

// --- Album Gallery Component ---
const AlbumGallery = ({ albums, onNavigate, isLoading, isPage = false }) => {
  if (isLoading) {
    return <div className="py-12 px-4 text-center text-white">Loading albums... <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-rose-500 mx-auto mt-2"></div></div>;
  }
  if (!albums || albums.length === 0) {
    return <div className="py-12 px-4 text-center text-white">No albums found. Admin can add new albums.</div>;
  }

  return (
    <section className={`py-12 md:py-20 ${isPage ? 'bg-gray-900' : 'bg-gray-800'}`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {!isPage && <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-12">Photo Albums</h2>}
        {isPage && <h1 className="text-4xl md:text-5xl font-bold text-center text-white mb-16">Explore Albums</h1>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
          {albums.map((album) => (
            <div
              key={album.id}
              onClick={() => onNavigate('album_detail', album.id)}
              className="group bg-gray-700 rounded-xl shadow-2xl overflow-hidden cursor-pointer transform hover:scale-105 transition-all duration-300 ease-in-out"
            >
              <div className="relative aspect-w-4 aspect-h-3">
                <img
                  src={album.coverImageUrl || `https://placehold.co/600x450/2D3748/9CA3AF?text=${encodeURIComponent(album.name)}`}
                  alt={album.name}
                  className="object-cover w-full h-full group-hover:opacity-80 transition-opacity duration-300"
                  onError={(e) => { e.target.onerror = null; e.target.src=`https://placehold.co/600x450/2D3748/9CA3AF?text=Image+Error`; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-rose-400 transition-colors duration-300">{album.name}</h3>
                {/* Optionally, add album description or photo count here */}
                <p className="text-sm text-gray-400">{album.description || "Click to view photos"}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// --- Album Page Component ---
const AlbumPage = ({ album, photos, onNavigate, isLoading }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const openLightbox = (index) => {
    setCurrentImageIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const showNextImage = (e) => {
    e.stopPropagation();
    setCurrentImageIndex((prevIndex) => (prevIndex + 1) % photos.length);
  };

  const showPrevImage = (e) => {
    e.stopPropagation();
    setCurrentImageIndex((prevIndex) => (prevIndex - 1 + photos.length) % photos.length);
  };
  
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!lightboxOpen) return;
      if (event.key === 'Escape') closeLightbox();
      if (event.key === 'ArrowRight') showNextImage(event);
      if (event.key === 'ArrowLeft') showPrevImage(event);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, photos.length]);


  if (isLoading) {
    return <div className="py-12 px-4 text-center text-white">Loading photos... <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-rose-500 mx-auto mt-2"></div></div>;
  }
  if (!album) {
    return <div className="py-12 px-4 text-center text-white">Album not found. <button onClick={() => onNavigate('albums')} className="text-rose-400 hover:underline">Back to albums</button></div>;
  }

  return (
    <section className="py-12 md:py-20 bg-gray-900 min-h-screen">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <button
            onClick={() => onNavigate('albums')}
            className="mb-8 flex items-center text-rose-400 hover:text-rose-300 transition duration-300 group"
        >
            <ArrowLeft size={20} className="mr-2 group-hover:-translate-x-1 transition-transform duration-300" />
            Back to Albums
        </button>
        <h1 className="text-4xl md:text-5xl font-bold text-center text-white mb-4">{album.name}</h1>
        {album.description && <p className="text-lg text-gray-300 text-center mb-12">{album.description}</p>}
        
        {photos.length === 0 ? (
          <p className="text-center text-gray-400 text-xl">No photos in this album yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {photos.map((photo, index) => (
              <div
                key={photo.id}
                className="group aspect-w-1 aspect-h-1 bg-gray-800 rounded-lg overflow-hidden shadow-lg cursor-pointer transform hover:scale-105 transition-transform duration-300"
                onClick={() => openLightbox(index)}
              >
                <img
                  src={photo.imageUrl || `https://placehold.co/400x400/2D3748/9CA3AF?text=Photo`}
                  alt={photo.title || 'Photograph'}
                  className="object-cover w-full h-full group-hover:opacity-75 transition-opacity duration-300"
                  onError={(e) => { e.target.onerror = null; e.target.src=`https://placehold.co/400x400/2D3748/9CA3AF?text=Error`; }}
                />
                {photo.title && (
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                    <h3 className="text-white text-sm font-semibold truncate">{photo.title}</h3>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {lightboxOpen && photos.length > 0 && (
        <div 
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={closeLightbox}
        >
          <button 
            onClick={closeLightbox} 
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-50 bg-black/50 rounded-full p-2"
            aria-label="Close lightbox"
          >
            <XCircle size={32} />
          </button>
          
          <button 
            onClick={showPrevImage}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 bg-black/50 rounded-full p-3 z-50"
            aria-label="Previous image"
          >
            <ArrowLeft size={32} />
          </button>

          <img 
            src={photos[currentImageIndex].imageUrl} 
            alt={photos[currentImageIndex].title || 'Enlarged photograph'}
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()} // Prevent closing lightbox when clicking image
            onError={(e) => { e.target.onerror = null; e.target.src=`https://placehold.co/800x600/1A202C/4A5568?text=Image+Load+Error`; }}
          />

          <button 
            onClick={showNextImage}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 bg-black/50 rounded-full p-3 z-50"
            aria-label="Next image"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0L13.5 19.5M21 12H3" />
            </svg>
          </button>
          {photos[currentImageIndex].title && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-lg bg-black/50 px-4 py-2 rounded-md">
              {photos[currentImageIndex].title} ({currentImageIndex + 1} / {photos.length})
            </div>
          )}
        </div>
      )}
    </section>
  );
};


// --- About Page Component ---
const AboutPage = () => {
  const profileImageUrl = "https://placehold.co/400x400/4A5568/E2E8F0?text=Louis"; // Placeholder
  return (
    <section className="py-12 md:py-20 bg-gray-800 min-h-screen">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl md:text-5xl font-bold text-center text-white mb-12">About Louis</h1>
        <div className="max-w-3xl mx-auto bg-gray-700 p-8 md:p-12 rounded-xl shadow-2xl">
          <div className="flex flex-col md:flex-row items-center md:items-start mb-8">
            <img 
              src={profileImageUrl} 
              alt="Louis the Photographer" 
              className="w-48 h-48 rounded-full object-cover mb-6 md:mb-0 md:mr-8 shadow-lg border-4 border-rose-500"
              onError={(e) => { e.target.onerror = null; e.target.src=`https://placehold.co/400x400/4A5568/E2E8F0?text=Louis`; }}
            />
            <div>
              <h2 className="text-3xl font-semibold text-white mb-3">Louis Placeholder Name</h2>
              <p className="text-rose-400 text-lg mb-4">Professional Photographer</p>
            </div>
          </div>
          <div className="text-gray-300 space-y-5 leading-relaxed">
            <p>
              Hello! I'm Louis, a passionate photographer dedicated to capturing the beauty, emotion, and fleeting moments that make life extraordinary. My journey into photography began [Number] years ago, and since then, I've been obsessed with light, composition, and storytelling through images.
            </p>
            <p>
              I specialize in [mention specializations, e.g., portrait, landscape, event, wedding photography]. My style is often described as [describe your style, e.g., natural, cinematic, vibrant, moody]. I believe that a great photograph is more than just a picture; it's a piece of art that evokes feeling and preserves a memory forever.
            </p>
            <p>
              Whether I'm hiking to a remote location for the perfect landscape shot, capturing the intimate moments of a wedding, or creating compelling portraits, my goal is always the same: to create images that resonate and endure.
            </p>
            <p>
              When I'm not behind the camera, you can find me [mention hobbies or interests]. I'm constantly learning and exploring new techniques to push my creative boundaries.
            </p>
            <p>
              Thank you for visiting my site. I hope you enjoy my work, and I look forward to the possibility of collaborating with you to capture your special moments.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

// --- Contact Section Component ---
const ContactSection = () => {
  return (
    <footer className="bg-gray-900 py-12 md:py-16 border-t border-gray-700">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-bold text-white mb-8">Get In Touch</h2>
        <p className="text-gray-400 mb-6 max-w-xl mx-auto">
          Have a project in mind or just want to say hello? I'd love to hear from you.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-8 mb-8">
          <a
            href="mailto:louis.photographer@example.com"
            className="flex items-center text-lg text-rose-400 hover:text-rose-300 transition duration-300"
          >
            <Mail size={24} className="mr-3" />
            louis.photographer@example.com
          </a>
          <a
            href="https://instagram.com/louisphotography" // Replace with actual Instagram link
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center text-lg text-rose-400 hover:text-rose-300 transition duration-300"
          >
            <Instagram size={24} className="mr-3" />
            @louisphotography
          </a>
        </div>
        <p className="text-gray-500 text-sm">
          &copy; {new Date().getFullYear()} Louis Photography. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

// --- Admin Login Component ---
const AdminLogin = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    // THIS IS A MOCK LOGIN - DO NOT USE IN PRODUCTION
    // In a real app, you'd authenticate against a backend or Firebase Auth.
    // For this demo, we'll use a hardcoded password and simulate a UID.
    if (password === 'louisadmin123') { // Super secret password, change for any real use
      // Simulate a UID for the admin. In a real scenario, this would come from Firebase Auth.
      const adminUID = 'mock-admin-uid-' + crypto.randomUUID();
      onLogin(adminUID);
    } else {
      setError('Incorrect password. This is a demo login.');
    }
    setIsLoading(false);
  };

  return (
    <section className="py-12 md:py-20 bg-gray-800 min-h-screen flex items-center justify-center">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-md">
        <div className="bg-gray-700 p-8 md:p-10 rounded-xl shadow-2xl">
          <h1 className="text-3xl font-bold text-center text-white mb-8">Admin Login</h1>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="password_admin" className="block text-sm font-medium text-gray-300 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password_admin"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-rose-500 focus:border-rose-500 sm:text-sm bg-gray-800 text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 text-gray-400 hover:text-gray-200"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-rose-600 hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 focus:ring-offset-gray-800 disabled:opacity-50 transition duration-300"
              >
                {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div> : 'Login'}
              </button>
            </div>
          </form>
          <p className="mt-6 text-center text-xs text-gray-400">
            Demo admin: Use password 'louisadmin123'.
          </p>
        </div>
      </div>
    </section>
  );
};

// --- Admin Panel Component ---
const AdminPanel = ({ albums, showNotification, currentUserId }) => {
  const [newAlbumName, setNewAlbumName] = useState('');
  const [newAlbumCoverUrl, setNewAlbumCoverUrl] = useState('');
  const [newAlbumDescription, setNewAlbumDescription] = useState('');

  const [selectedAlbumForPhoto, setSelectedAlbumForPhoto] = useState('');
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [newPhotoTitle, setNewPhotoTitle] = useState('');
  const [isSubmittingAlbum, setIsSubmittingAlbum] = useState(false);
  const [isSubmittingPhoto, setIsSubmittingPhoto] = useState(false);
  const [isDeleting, setIsDeleting] = useState(null); // Stores ID of item being deleted

  // --- Create New Album ---
  const handleCreateAlbum = async (e) => {
    e.preventDefault();
    if (!newAlbumName.trim() || !newAlbumCoverUrl.trim()) {
      showNotification('Album name and cover URL are required.', 'error');
      return;
    }
    if (!currentUserId) {
        showNotification('User not authenticated. Cannot create album.', 'error');
        return;
    }
    setIsSubmittingAlbum(true);
    try {
      const albumsCollectionRef = collection(db, `artifacts/${appId}/public/data/albums`);
      await addDoc(albumsCollectionRef, {
        name: newAlbumName,
        coverImageUrl: newAlbumCoverUrl,
        description: newAlbumDescription,
        createdAt: new Date(),
        createdBy: currentUserId 
      });
      showNotification('Album created successfully!', 'success');
      setNewAlbumName('');
      setNewAlbumCoverUrl('');
      setNewAlbumDescription('');
    } catch (error) {
      console.error("Error creating album:", error);
      showNotification(`Error creating album: ${error.message}`, 'error');
    }
    setIsSubmittingAlbum(false);
  };

  // --- Add Photo to Album ---
  const handleAddPhoto = async (e) => {
    e.preventDefault();
    if (!selectedAlbumForPhoto || !newPhotoUrl.trim()) {
      showNotification('Please select an album and provide a photo URL.', 'error');
      return;
    }
    if (!currentUserId) {
        showNotification('User not authenticated. Cannot add photo.', 'error');
        return;
    }
    setIsSubmittingPhoto(true);
    try {
      const photosCollectionRef = collection(db, `artifacts/${appId}/public/data/photos`);
      await addDoc(photosCollectionRef, {
        albumId: selectedAlbumForPhoto,
        imageUrl: newPhotoUrl,
        title: newPhotoTitle,
        uploadedAt: new Date(),
        uploadedBy: currentUserId
      });
      showNotification('Photo added successfully!', 'success');
      setNewPhotoUrl('');
      setNewPhotoTitle('');
      // Optionally reset selectedAlbumForPhoto or keep it for multiple uploads
    } catch (error) {
      console.error("Error adding photo:", error);
      showNotification(`Error adding photo: ${error.message}`, 'error');
    }
    setIsSubmittingPhoto(false);
  };

  // --- Delete Album (and its photos) ---
  const handleDeleteAlbum = async (albumId) => {
    // A real confirmation modal should be used here.
    // For simplicity, window.confirm is used, but it's not ideal in iframes.
    // A custom modal component would be better.
    if (!confirm(`Are you sure you want to delete this album and all its photos? This action cannot be undone.`)) {
        return;
    }
    setIsDeleting(albumId);
    try {
        // 1. Delete photos in the album
        const photosCollectionRef = collection(db, `artifacts/${appId}/public/data/photos`);
        const q = query(photosCollectionRef, where("albumId", "==", albumId));
        const photoSnapshot = await getDocs(q);
        const deletePromises = [];
        photoSnapshot.forEach((photoDoc) => {
            deletePromises.push(deleteDoc(doc(db, `artifacts/${appId}/public/data/photos`, photoDoc.id)));
        });
        await Promise.all(deletePromises);

        // 2. Delete the album
        await deleteDoc(doc(db, `artifacts/${appId}/public/data/albums`, albumId));
        
        showNotification('Album and its photos deleted successfully!', 'success');
    } catch (error) {
        console.error("Error deleting album:", error);
        showNotification(`Error deleting album: ${error.message}`, 'error');
    }
    setIsDeleting(null);
  };
  
  // --- Delete Photo ---
  const handleDeletePhoto = async (photoId, albumIdToRefresh) => {
     if (!confirm(`Are you sure you want to delete this photo? This action cannot be undone.`)) {
        return;
    }
    setIsDeleting(photoId);
    try {
        await deleteDoc(doc(db, `artifacts/${appId}/public/data/photos`, photoId));
        showNotification('Photo deleted successfully!', 'success');
        // Potentially trigger a refresh of photos for the current album if viewing one
    } catch (error) {
        console.error("Error deleting photo:", error);
        showNotification(`Error deleting photo: ${error.message}`, 'error');
    }
    setIsDeleting(null);
  };


  return (
    <section className="py-12 md:py-20 bg-gray-800 min-h-screen">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-center text-white mb-12">Admin Panel</h1>

        {/* Create Album Form */}
        <div className="bg-gray-700 p-6 md:p-8 rounded-xl shadow-xl mb-12">
          <h2 className="text-2xl font-semibold text-white mb-6">Create New Album</h2>
          <form onSubmit={handleCreateAlbum} className="space-y-4">
            <div>
              <label htmlFor="albumName" className="block text-sm font-medium text-gray-300 mb-1">Album Name</label>
              <input type="text" id="albumName" value={newAlbumName} onChange={(e) => setNewAlbumName(e.target.value)} required className="w-full p-2 rounded-md bg-gray-800 text-white border border-gray-600 focus:ring-rose-500 focus:border-rose-500" />
            </div>
            <div>
              <label htmlFor="albumCoverUrl" className="block text-sm font-medium text-gray-300 mb-1">Cover Image URL</label>
              <input type="url" id="albumCoverUrl" value={newAlbumCoverUrl} onChange={(e) => setNewAlbumCoverUrl(e.target.value)} required className="w-full p-2 rounded-md bg-gray-800 text-white border border-gray-600 focus:ring-rose-500 focus:border-rose-500" />
            </div>
            <div>
              <label htmlFor="albumDescription" className="block text-sm font-medium text-gray-300 mb-1">Album Description (Optional)</label>
              <textarea id="albumDescription" value={newAlbumDescription} onChange={(e) => setNewAlbumDescription(e.target.value)} rows="3" className="w-full p-2 rounded-md bg-gray-800 text-white border border-gray-600 focus:ring-rose-500 focus:border-rose-500"></textarea>
            </div>
            <button type="submit" disabled={isSubmittingAlbum} className="bg-rose-600 hover:bg-rose-500 text-white font-semibold py-2 px-4 rounded-md transition duration-300 disabled:opacity-50 flex items-center">
              {isSubmittingAlbum ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div> : <PlusCircle size={18} className="mr-2" />}
              Create Album
            </button>
          </form>
        </div>

        {/* Add Photo Form */}
        <div className="bg-gray-700 p-6 md:p-8 rounded-xl shadow-xl mb-12">
          <h2 className="text-2xl font-semibold text-white mb-6">Add Photo to Album</h2>
          <form onSubmit={handleAddPhoto} className="space-y-4">
            <div>
              <label htmlFor="selectAlbum" className="block text-sm font-medium text-gray-300 mb-1">Select Album</label>
              <select id="selectAlbum" value={selectedAlbumForPhoto} onChange={(e) => setSelectedAlbumForPhoto(e.target.value)} required className="w-full p-2 rounded-md bg-gray-800 text-white border border-gray-600 focus:ring-rose-500 focus:border-rose-500">
                <option value="">-- Select an Album --</option>
                {albums.map(album => (
                  <option key={album.id} value={album.id}>{album.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="photoUrl" className="block text-sm font-medium text-gray-300 mb-1">Photo URL</label>
              <input type="url" id="photoUrl" value={newPhotoUrl} onChange={(e) => setNewPhotoUrl(e.target.value)} required className="w-full p-2 rounded-md bg-gray-800 text-white border border-gray-600 focus:ring-rose-500 focus:border-rose-500" />
            </div>
            <div>
              <label htmlFor="photoTitle" className="block text-sm font-medium text-gray-300 mb-1">Photo Title (Optional)</label>
              <input type="text" id="photoTitle" value={newPhotoTitle} onChange={(e) => setNewPhotoTitle(e.target.value)} className="w-full p-2 rounded-md bg-gray-800 text-white border border-gray-600 focus:ring-rose-500 focus:border-rose-500" />
            </div>
            <button type="submit" disabled={isSubmittingPhoto} className="bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-4 rounded-md transition duration-300 disabled:opacity-50 flex items-center">
              {isSubmittingPhoto ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div> : <ImageIcon size={18} className="mr-2" />}
              Add Photo
            </button>
          </form>
        </div>

        {/* Manage Albums */}
        <div className="bg-gray-700 p-6 md:p-8 rounded-xl shadow-xl">
            <h2 className="text-2xl font-semibold text-white mb-6">Manage Albums</h2>
            {albums.length === 0 ? (
                <p className="text-gray-400">No albums created yet.</p>
            ) : (
                <ul className="space-y-3">
                    {albums.map(album => (
                        <li key={album.id} className="flex justify-between items-center bg-gray-800 p-3 rounded-md">
                            <span className="text-gray-200">{album.name}</span>
                            <button 
                                onClick={() => handleDeleteAlbum(album.id)}
                                disabled={isDeleting === album.id}
                                className="text-red-500 hover:text-red-400 disabled:opacity-50 p-1 rounded-md hover:bg-red-900/50 transition-colors"
                                title="Delete Album"
                            >
                                {isDeleting === album.id ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div> : <Trash2 size={18} />}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
        {/* TODO: Add Manage Photos section - more complex, might need to load photos per album */}

      </div>
    </section>
  );
};


export default App;
