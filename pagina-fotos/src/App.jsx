import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, doc, deleteDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { Home, Image, Info, Mail, Instagram, PlusCircle, Trash2, Loader, LogOut } from 'lucide-react';

// Context for Firebase and User
export const AppContext = createContext();

/**
 * App component - Main entry point of the application.
 * Manages Firebase initialization, authentication, and routing.
 */
function App() {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [currentPage, setCurrentPage] = useState('home');
    const [selectedAlbumId, setSelectedAlbumId] = useState(null); // State for navigating to album detail page

    useEffect(() => {
        /**
         * Initializes Firebase and sets up authentication.
         * Attempts to sign in with a custom token if available, otherwise anonymously.
         */
        const initializeFirebase = async () => {
            try {
                // Retrieve app ID and Firebase config from global variables
                const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
                const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

                // Initialize Firebase app, Firestore, and Auth
                const app = initializeApp(firebaseConfig);
                const firestoreDb = getFirestore(app);
                const firebaseAuth = getAuth(app);

                setDb(firestoreDb);
                setAuth(firebaseAuth);

                // Set up authentication state listener
                const unsubscribeAuth = onAuthStateChanged(firebaseAuth, async (user) => {
                    if (user) {
                        // User is signed in
                        setUserId(user.uid);
                        setIsAuthReady(true);
                    } else {
                        // No user is signed in, attempt to sign in
                        try {
                            if (typeof __initial_auth_token !== 'undefined') {
                                // Sign in with custom token if provided
                                await signInWithCustomToken(firebaseAuth, __initial_auth_token);
                            } else {
                                // Otherwise, sign in anonymously
                                await signInAnonymously(firebaseAuth);
                            }
                        } catch (error) {
                            console.error("Firebase Authentication Error:", error);
                            // Fallback to a random UUID if all sign-in methods fail
                            setUserId(crypto.randomUUID());
                            setIsAuthReady(true);
                        }
                    }
                });

                // Cleanup function for the auth listener
                return () => unsubscribeAuth();
            } catch (error) {
                console.error("Failed to initialize Firebase:", error);
                setIsAuthReady(true); // Allow the app to render even if Firebase initialization fails
            }
        };

        initializeFirebase();
    }, []); // Empty dependency array ensures this runs only once on mount

    /**
     * Handles navigation to a specific album detail page.
     * @param {string} albumId - The ID of the album to display.
     */
    const handleViewAlbum = (albumId) => {
        setSelectedAlbumId(albumId);
        setCurrentPage('albumDetail');
    };

    /**
     * Renders the current page based on the `currentPage` state.
     */
    const renderPage = () => {
        if (!isAuthReady) {
            // Show a loading indicator while authentication is being set up
            return (
                <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
                    <Loader className="animate-spin mr-2" size={32} />
                    <p>Loading application...</p>
                </div>
            );
        }

        switch (currentPage) {
            case 'home':
                return <HomePage setCurrentPage={setCurrentPage} handleViewAlbum={handleViewAlbum} />;
            case 'gallery':
                return <GalleryPage handleViewAlbum={handleViewAlbum} />;
            case 'albumDetail':
                return <AlbumDetailPage albumId={selectedAlbumId} setCurrentPage={setCurrentPage} />;
            case 'about':
                return <AboutPage />;
            case 'contact':
                return <ContactPage />;
            case 'admin':
                return <AdminPage userId={userId} />;
            default:
                return <HomePage setCurrentPage={setCurrentPage} handleViewAlbum={handleViewAlbum} />;
        }
    };

    return (
        <AppContext.Provider value={{ db, auth, userId, isAuthReady }}>
            <div className="min-h-screen bg-gray-900 text-gray-100 font-inter">
                <Navbar setCurrentPage={setCurrentPage} userId={userId} />
                {renderPage()}
            </div>
        </AppContext.Provider>
    );
}

/**
 * Navbar component - Provides navigation links.
 */
function Navbar({ setCurrentPage, userId }) {
    const { auth } = useContext(AppContext);

    /**
     * Handles user logout.
     */
    const handleLogout = async () => {
        if (auth) {
            try {
                await auth.signOut();
                // Optionally, sign in anonymously again after logout if desired
                await signInAnonymously(auth);
                console.log("User logged out and signed in anonymously.");
            } catch (error) {
                console.error("Error signing out:", error);
            }
        }
    };

    return (
        <nav className="bg-gray-800 p-4 shadow-lg sticky top-0 z-50">
            <div className="container mx-auto flex flex-col md:flex-row justify-between items-center">
                <h1 className="text-3xl font-bold text-amber-400 mb-2 md:mb-0">Louis Photography</h1>
                <div className="flex flex-wrap justify-center gap-4">
                    <NavItem icon={<Home size={20} />} text="Home" onClick={() => setCurrentPage('home')} />
                    <NavItem icon={<Image size={20} />} text="Gallery" onClick={() => setCurrentPage('gallery')} />
                    <NavItem icon={<Info size={20} />} text="About" onClick={() => setCurrentPage('about')} />
                    <NavItem icon={<Mail size={20} />} text="Contact" onClick={() => setCurrentPage('contact')} />
                    <NavItem icon={<PlusCircle size={20} />} text="Admin" onClick={() => setCurrentPage('admin')} />
                    {userId && (
                        <div className="flex items-center text-sm text-gray-400 ml-4">
                            <span>User ID: {userId}</span>
                            <button
                                onClick={handleLogout}
                                className="ml-2 p-1 rounded-full hover:bg-gray-700 transition-colors"
                                title="Logout"
                            >
                                <LogOut size={18} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}

/**
 * NavItem component - Reusable navigation link button.
 */
function NavItem({ icon, text, onClick }) {
    return (
        <button
            onClick={onClick}
            className="flex items-center px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors duration-300 text-white shadow-md"
        >
            {icon && <span className="mr-2">{icon}</span>}
            {text}
        </button>
    );
}

/**
 * HomePage component - Displays the hero section, a preview of albums, and contact info.
 */
function HomePage({ setCurrentPage, handleViewAlbum }) {
    const { db, isAuthReady } = useContext(AppContext);
    const [albums, setAlbums] = useState([]);

    useEffect(() => {
        if (!db || !isAuthReady) return;

        // Fetch albums from Firestore
        const publicAlbumsCollectionRef = collection(db, `artifacts/${typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'}/public/data/albums`);
        const unsubscribe = onSnapshot(publicAlbumsCollectionRef, (snapshot) => {
            const fetchedAlbums = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort albums by timestamp in descending order (most recent first)
            fetchedAlbums.sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));
            setAlbums(fetchedAlbums);
        }, (error) => {
            console.error("Error fetching albums:", error);
        });

        return () => unsubscribe(); // Cleanup listener
    }, [db, isAuthReady]);

    const heroImageUrl = "https://placehold.co/1600x900/1a202c/e2e8f0?text=Capturing+Moments"; // Placeholder for hero image

    return (
        <div className="space-y-16 pb-16">
            {/* Hero Section */}
            <section className="relative w-full h-screen flex items-center justify-center overflow-hidden">
                <img
                    src={heroImageUrl}
                    alt="Hero Background"
                    className="absolute inset-0 w-full h-full object-cover filter brightness-75"
                    onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/1600x900/1a202c/e2e8f0?text=Capturing+Moments"; }}
                />
                <div className="relative z-10 text-center p-8 bg-black bg-opacity-50 rounded-xl shadow-2xl">
                    <h2 className="text-5xl md:text-7xl font-extrabold text-white mb-4 drop-shadow-lg">
                        Louis Photography
                    </h2>
                    <p className="text-xl md:text-2xl text-gray-200 italic">
                        "Where every click tells a story."
                    </p>
                    <button
                        onClick={() => setCurrentPage('gallery')}
                        className="mt-8 px-8 py-4 bg-amber-500 text-gray-900 font-bold text-lg rounded-full shadow-lg hover:bg-amber-400 transition-transform transform hover:scale-105"
                    >
                        View Gallery
                    </button>
                </div>
            </section>

            {/* Albums Preview Section */}
            <section className="container mx-auto px-4">
                <h3 className="text-4xl font-bold text-center text-amber-400 mb-10">Featured Albums</h3>
                {albums.length === 0 ? (
                    <p className="text-center text-gray-400">No albums yet. Please add some from the Admin page!</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                        {albums.slice(0, 4).map((album) => ( // Show up to 4 featured albums
                            <AlbumThumbnail key={album.id} album={album} onClick={() => handleViewAlbum(album.id)} />
                        ))}
                    </div>
                )}
                {albums.length > 4 && (
                    <div className="text-center mt-10">
                        <button
                            onClick={() => setCurrentPage('gallery')}
                            className="px-6 py-3 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors"
                        >
                            View All Albums
                        </button>
                    </div>
                )}
            </section>

            {/* Contact Section Preview */}
            <section className="container mx-auto px-4">
                <ContactPage />
            </section>
        </div>
    );
}

/**
 * AlbumThumbnail component - Displays a single album thumbnail.
 */
function AlbumThumbnail({ album, onClick }) {
    const placeholderImage = "https://placehold.co/400x300/334155/f8fafc?text=Album+Cover";
    return (
        <div
            onClick={onClick}
            className="group relative overflow-hidden rounded-xl shadow-xl cursor-pointer transform transition-transform hover:scale-105 duration-300 bg-gray-800"
        >
            <img
                src={album.thumbnailUrl || placeholderImage}
                alt={album.name}
                className="w-full h-64 object-cover transition-opacity duration-300 group-hover:opacity-75"
                onError={(e) => { e.target.onerror = null; e.target.src = placeholderImage; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                <h4 className="text-xl font-semibold text-white">{album.name}</h4>
            </div>
        </div>
    );
}

/**
 * GalleryPage component - Displays all available albums.
 */
function GalleryPage({ handleViewAlbum }) {
    const { db, isAuthReady } = useContext(AppContext);
    const [albums, setAlbums] = useState([]);

    useEffect(() => {
        if (!db || !isAuthReady) return;

        // Fetch albums from Firestore
        const publicAlbumsCollectionRef = collection(db, `artifacts/${typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'}/public/data/albums`);
        const unsubscribe = onSnapshot(publicAlbumsCollectionRef, (snapshot) => {
            const fetchedAlbums = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            fetchedAlbums.sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));
            setAlbums(fetchedAlbums);
        }, (error) => {
            console.error("Error fetching albums:", error);
        });

        return () => unsubscribe();
    }, [db, isAuthReady]);

    return (
        <div className="container mx-auto p-8 min-h-screen">
            <h2 className="text-5xl font-bold text-center text-amber-400 mb-12">Our Photo Albums</h2>
            {albums.length === 0 ? (
                <p className="text-center text-gray-400 text-lg">No albums available. Check back soon!</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                    {albums.map((album) => (
                        <AlbumThumbnail key={album.id} album={album} onClick={() => handleViewAlbum(album.id)} />
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * AlbumDetailPage component - Displays photos within a specific album.
 */
function AlbumDetailPage({ albumId, setCurrentPage }) {
    const { db, isAuthReady } = useContext(AppContext);
    const [album, setAlbum] = useState(null);
    const [photos, setPhotos] = useState([]);
    const placeholderImage = "https://placehold.co/600x400/334155/f8fafc?text=Image+Not+Found";

    useEffect(() => {
        if (!db || !isAuthReady || !albumId) return;

        // Fetch album details
        const albumDocRef = doc(db, `artifacts/${typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'}/public/data/albums`, albumId);
        const unsubscribeAlbum = onSnapshot(albumDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setAlbum({ id: docSnap.id, ...docSnap.data() });
            } else {
                console.log("No such album!");
                setAlbum(null);
                setCurrentPage('gallery'); // Redirect to gallery if album not found
            }
        }, (error) => {
            console.error("Error fetching album details:", error);
        });

        // Fetch photos for the album
        const photosCollectionRef = collection(db, `artifacts/${typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'}/public/data/photos`);
        const q = query(photosCollectionRef, where("albumId", "==", albumId));
        const unsubscribePhotos = onSnapshot(q, (snapshot) => {
            const fetchedPhotos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            fetchedPhotos.sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));
            setPhotos(fetchedPhotos);
        }, (error) => {
            console.error("Error fetching photos:", error);
        });

        return () => {
            unsubscribeAlbum();
            unsubscribePhotos();
        };
    }, [db, isAuthReady, albumId, setCurrentPage]);

    if (!album) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
                <Loader className="animate-spin mr-2" size={32} />
                <p>Loading album...</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-8 min-h-screen">
            <button
                onClick={() => setCurrentPage('gallery')}
                className="mb-8 px-6 py-3 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors flex items-center"
            >
                &larr; Back to Gallery
            </button>
            <h2 className="text-5xl font-bold text-center text-amber-400 mb-12">{album.name}</h2>
            {photos.length === 0 ? (
                <p className="text-center text-gray-400 text-lg">No photos in this album yet.</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                    {photos.map((photo) => (
                        <div key={photo.id} className="relative overflow-hidden rounded-xl shadow-xl bg-gray-800 group">
                            <img
                                src={photo.imageUrl || placeholderImage}
                                alt={photo.caption || "Album photo"}
                                className="w-full h-64 object-cover transition-transform duration-300 group-hover:scale-105"
                                onError={(e) => { e.target.onerror = null; e.target.src = placeholderImage; }}
                            />
                            {photo.caption && (
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    <p className="text-white text-sm">{photo.caption}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * AboutPage component - Contains information about Louis.
 */
function AboutPage() {
    return (
        <div className="container mx-auto p-8 min-h-screen flex flex-col items-center justify-center">
            <h2 className="text-5xl font-bold text-center text-amber-400 mb-12">About Louis</h2>
            <div className="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-3xl text-lg leading-relaxed text-gray-200">
                <p className="mb-6">
                    Louis is a passionate photographer with over 15 years of experience capturing the beauty of the world through his lens.
                    From breathtaking landscapes to intimate portraits, his work is characterized by a keen eye for detail,
                    a mastery of light, and a deep emotional connection to his subjects.
                </p>
                <p className="mb-6">
                    Born and raised in a small town, Louis discovered his love for photography at an early age,
                    fascinated by how a single frame could tell a compelling story. He honed his skills through
                    years of dedicated practice, formal training, and countless adventures exploring diverse cultures and environments.
                </p>
                <p>
                    His philosophy is simple: to create timeless images that evoke emotion and leave a lasting impression.
                    Louis believes that photography is not just about taking pictures, but about seeing, feeling, and
                    preserving moments that matter. He is available for commissioned work, collaborations, and welcomes
                    opportunities to share his vision with a wider audience.
                </p>
            </div>
        </div>
    );
}

/**
 * ContactPage component - Provides contact information.
 */
function ContactPage() {
    return (
        <div className="container mx-auto p-8 min-h-screen flex flex-col items-center justify-center">
            <h2 className="text-5xl font-bold text-center text-amber-400 mb-12">Get in Touch</h2>
            <div className="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-xl text-center text-gray-200">
                <p className="text-xl mb-6">
                    Interested in working together or have a question? Feel free to reach out!
                </p>
                <div className="space-y-4 mb-8">
                    <p className="flex items-center justify-center text-lg">
                        <Mail size={24} className="mr-3 text-amber-400" />
                        Email: <a href="mailto:louis.photography@example.com" className="text-amber-300 hover:underline ml-2">louis.photography@example.com</a>
                    </p>
                    <p className="flex items-center justify-center text-lg">
                        <Instagram size={24} className="mr-3 text-amber-400" />
                        Instagram: <a href="https://www.instagram.com/louis_photography" target="_blank" rel="noopener noreferrer" className="text-amber-300 hover:underline ml-2">@louis_photography</a>
                    </p>
                </div>
                <p className="text-sm text-gray-400">
                    You can also use the contact form below (placeholder for future implementation).
                </p>
                {/* Placeholder for a contact form */}
                <form className="mt-8 space-y-4">
                    <input
                        type="text"
                        placeholder="Your Name"
                        className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500 text-white"
                    />
                    <input
                        type="email"
                        placeholder="Your Email"
                        className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500 text-white"
                    />
                    <textarea
                        placeholder="Your Message"
                        rows="5"
                        className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500 text-white"
                    ></textarea>
                    <button
                        type="submit"
                        className="w-full px-6 py-3 bg-amber-500 text-gray-900 font-bold rounded-lg shadow-md hover:bg-amber-400 transition-colors"
                    >
                        Send Message
                    </button>
                </form>
            </div>
        </div>
    );
}

/**
 * AdminPage component - Provides forms for managing albums and photos.
 * NOTE: In a real-world application, this page would require robust role-based access control
 * to ensure only authorized administrators can access and modify content.
 * For this demonstration, any authenticated user can access this page.
 */
function AdminPage({ userId }) {
    const { db, isAuthReady } = useContext(AppContext);
    const [albumName, setAlbumName] = useState('');
    const [albumThumbnailUrl, setAlbumThumbnailUrl] = useState('');
    const [albums, setAlbums] = useState([]);
    const [selectedAlbumForPhoto, setSelectedAlbumForPhoto] = useState('');
    const [photoImageUrl, setPhotoImageUrl] = useState('');
    const [photoCaption, setPhotoCaption] = useState('');
    const [photos, setPhotos] = useState([]);
    const [message, setMessage] = useState('');

    const publicAlbumsCollectionPath = `artifacts/${typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'}/public/data/albums`;
    const publicPhotosCollectionPath = `artifacts/${typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'}/public/data/photos`;

    useEffect(() => {
        if (!db || !isAuthReady) return;

        // Fetch albums
        const unsubscribeAlbums = onSnapshot(collection(db, publicAlbumsCollectionPath), (snapshot) => {
            const fetchedAlbums = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            fetchedAlbums.sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));
            setAlbums(fetchedAlbums);
            if (fetchedAlbums.length > 0 && !selectedAlbumForPhoto) {
                setSelectedAlbumForPhoto(fetchedAlbums[0].id); // Select first album by default
            }
        }, (error) => {
            console.error("Error fetching albums for admin:", error);
        });

        // Fetch photos
        const unsubscribePhotos = onSnapshot(collection(db, publicPhotosCollectionPath), (snapshot) => {
            const fetchedPhotos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            fetchedPhotos.sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));
            setPhotos(fetchedPhotos);
        }, (error) => {
            console.error("Error fetching photos for admin:", error);
        });

        return () => {
            unsubscribeAlbums();
            unsubscribePhotos();
        };
    }, [db, isAuthReady, publicAlbumsCollectionPath, publicPhotosCollectionPath]);

    /**
     * Handles adding a new album to Firestore.
     * @param {Event} e - The form submission event.
     */
    const handleAddAlbum = async (e) => {
        e.preventDefault();
        if (!db || !albumName.trim() || !albumThumbnailUrl.trim()) {
            setMessage('Album name and thumbnail URL are required.');
            return;
        }

        try {
            await addDoc(collection(db, publicAlbumsCollectionPath), {
                name: albumName,
                thumbnailUrl: albumThumbnailUrl,
                timestamp: serverTimestamp(),
                createdBy: userId // Track who created the album
            });
            setAlbumName('');
            setAlbumThumbnailUrl('');
            setMessage('Album added successfully!');
        } catch (error) {
            console.error("Error adding album:", error);
            setMessage(`Error adding album: ${error.message}`);
        }
    };

    /**
     * Handles adding a new photo to a selected album in Firestore.
     * @param {Event} e - The form submission event.
     */
    const handleAddPhoto = async (e) => {
        e.preventDefault();
        if (!db || !selectedAlbumForPhoto || !photoImageUrl.trim()) {
            setMessage('Please select an album and provide an image URL.');
            return;
        }

        try {
            await addDoc(collection(db, publicPhotosCollectionPath), {
                albumId: selectedAlbumForPhoto,
                imageUrl: photoImageUrl,
                caption: photoCaption,
                timestamp: serverTimestamp(),
                createdBy: userId // Track who added the photo
            });
            setPhotoImageUrl('');
            setPhotoCaption('');
            setMessage('Photo added successfully!');
        } catch (error) {
            console.error("Error adding photo:", error);
            setMessage(`Error adding photo: ${error.message}`);
        }
    };

    /**
     * Handles deleting an album and its associated photos from Firestore.
     * @param {string} albumIdToDelete - The ID of the album to delete.
     */
    const handleDeleteAlbum = async (albumIdToDelete) => {
        if (!db) return;
        if (!window.confirm("Are you sure you want to delete this album and all its photos?")) {
            return; // Use window.confirm for simplicity, but a custom modal is preferred in production.
        }

        try {
            // Delete associated photos first
            const photosQuery = query(collection(db, publicPhotosCollectionPath), where("albumId", "==", albumIdToDelete));
            const photoDocs = await getDocs(photosQuery);
            const deletePhotoPromises = photoDocs.docs.map(d => deleteDoc(doc(db, publicPhotosCollectionPath, d.id)));
            await Promise.all(deletePhotoPromises);

            // Delete the album document
            await deleteDoc(doc(db, publicAlbumsCollectionPath, albumIdToDelete));
            setMessage('Album and associated photos deleted successfully!');
        } catch (error) {
            console.error("Error deleting album:", error);
            setMessage(`Error deleting album: ${error.message}`);
        }
    };

    /**
     * Handles deleting a single photo from Firestore.
     * @param {string} photoIdToDelete - The ID of the photo to delete.
     */
    const handleDeletePhoto = async (photoIdToDelete) => {
        if (!db) return;
        if (!window.confirm("Are you sure you want to delete this photo?")) {
            return; // Use window.confirm for simplicity, but a custom modal is preferred in production.
        }

        try {
            await deleteDoc(doc(db, publicPhotosCollectionPath, photoIdToDelete));
            setMessage('Photo deleted successfully!');
        } catch (error) {
            console.error("Error deleting photo:", error);
            setMessage(`Error deleting photo: ${error.message}`);
        }
    };

    return (
        <div className="container mx-auto p-8 min-h-screen">
            <h2 className="text-5xl font-bold text-center text-amber-400 mb-12">Admin Panel</h2>

            {message && (
                <div className="bg-blue-600 text-white p-4 rounded-lg mb-6 text-center shadow-md">
                    {message}
                </div>
            )}

            {/* User ID Display */}
            <div className="bg-gray-800 p-4 rounded-lg shadow-md mb-8 text-center text-gray-300">
                <p>Your current User ID: <span className="font-mono text-amber-300 break-all">{userId}</span></p>
                <p className="text-sm text-gray-400 mt-2">
                    This ID is used for authentication and data ownership. In a production app,
                    you'd implement role-based access control to restrict admin features.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                {/* Add New Album Form */}
                <div className="bg-gray-800 p-8 rounded-xl shadow-2xl">
                    <h3 className="text-3xl font-semibold text-amber-400 mb-6">Add New Album</h3>
                    <form onSubmit={handleAddAlbum} className="space-y-6">
                        <div>
                            <label htmlFor="albumName" className="block text-gray-300 text-lg font-medium mb-2">Album Name</label>
                            <input
                                type="text"
                                id="albumName"
                                value={albumName}
                                onChange={(e) => setAlbumName(e.target.value)}
                                className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500 text-white"
                                placeholder="e.g., Landscape Adventures"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="albumThumbnailUrl" className="block text-gray-300 text-lg font-medium mb-2">Thumbnail Image URL</label>
                            <input
                                type="url"
                                id="albumThumbnailUrl"
                                value={albumThumbnailUrl}
                                onChange={(e) => setAlbumThumbnailUrl(e.target.value)}
                                className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500 text-white"
                                placeholder="e.g., https://placehold.co/400x300"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full px-6 py-3 bg-amber-500 text-gray-900 font-bold rounded-lg shadow-md hover:bg-amber-400 transition-colors flex items-center justify-center"
                        >
                            <PlusCircle size={20} className="mr-2" /> Add Album
                        </button>
                    </form>
                </div>

                {/* Add New Photo Form */}
                <div className="bg-gray-800 p-8 rounded-xl shadow-2xl">
                    <h3 className="text-3xl font-semibold text-amber-400 mb-6">Add New Photo</h3>
                    <form onSubmit={handleAddPhoto} className="space-y-6">
                        <div>
                            <label htmlFor="selectAlbum" className="block text-gray-300 text-lg font-medium mb-2">Select Album</label>
                            <select
                                id="selectAlbum"
                                value={selectedAlbumForPhoto}
                                onChange={(e) => setSelectedAlbumForPhoto(e.target.value)}
                                className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500 text-white"
                                required
                            >
                                <option value="">-- Select an Album --</option>
                                {albums.map((album) => (
                                    <option key={album.id} value={album.id}>{album.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="photoImageUrl" className="block text-gray-300 text-lg font-medium mb-2">Photo Image URL</label>
                            <input
                                type="url"
                                id="photoImageUrl"
                                value={photoImageUrl}
                                onChange={(e) => setPhotoImageUrl(e.target.value)}
                                className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500 text-white"
                                placeholder="e.g., https://placehold.co/600x400"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="photoCaption" className="block text-gray-300 text-lg font-medium mb-2">Caption (Optional)</label>
                            <input
                                type="text"
                                id="photoCaption"
                                value={photoCaption}
                                onChange={(e) => setPhotoCaption(e.target.value)}
                                className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500 text-white"
                                placeholder="e.g., Sunset over the mountains"
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full px-6 py-3 bg-amber-500 text-gray-900 font-bold rounded-lg shadow-md hover:bg-amber-400 transition-colors flex items-center justify-center"
                        >
                            <PlusCircle size={20} className="mr-2" /> Add Photo
                        </button>
                    </form>
                </div>
            </div>

            {/* Manage Existing Albums */}
            <div className="mt-16 bg-gray-800 p-8 rounded-xl shadow-2xl">
                <h3 className="text-3xl font-semibold text-amber-400 mb-6">Manage Albums</h3>
                {albums.length === 0 ? (
                    <p className="text-gray-400">No albums created yet.</p>
                ) : (
                    <div className="space-y-4">
                        {albums.map((album) => (
                            <div key={album.id} className="flex items-center justify-between bg-gray-700 p-4 rounded-lg shadow-md">
                                <span className="text-lg text-white">{album.name}</span>
                                <button
                                    onClick={() => handleDeleteAlbum(album.id)}
                                    className="p-2 bg-red-600 text-white rounded-full hover:bg-red-500 transition-colors"
                                    title="Delete Album"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Manage Existing Photos */}
            <div className="mt-16 bg-gray-800 p-8 rounded-xl shadow-2xl">
                <h3 className="text-3xl font-semibold text-amber-400 mb-6">Manage Photos</h3>
                {photos.length === 0 ? (
                    <p className="text-gray-400">No photos added yet.</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {photos.map((photo) => (
                            <div key={photo.id} className="relative bg-gray-700 rounded-lg overflow-hidden shadow-md group">
                                <img
                                    src={photo.imageUrl || "https://placehold.co/200x150/334155/f8fafc?text=No+Image"}
                                    alt={photo.caption || "Photo"}
                                    className="w-full h-40 object-cover"
                                    onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/200x150/334155/f8fafc?text=No+Image"; }}
                                />
                                <div className="p-3">
                                    <p className="text-sm text-gray-300 truncate">{photo.caption || 'No Caption'}</p>
                                    <p className="text-xs text-gray-400">Album: {albums.find(a => a.id === photo.albumId)?.name || 'Unknown'}</p>
                                </div>
                                <button
                                    onClick={() => handleDeletePhoto(photo.id)}
                                    className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-500 transition-opacity opacity-0 group-hover:opacity-100"
                                    title="Delete Photo"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;
