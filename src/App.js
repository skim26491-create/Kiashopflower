import "./App.css";
import React, { useEffect, useMemo, useState } from "react";
import { auth, db } from "./firebase";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  query,
  where,
} from "firebase/firestore";

const initialProducts = [
  { id: "1", name: "Blushing Baby's Breath", price: 14.0, img: "img/baby flower.jpg" },
  { id: "2", name: "Single Sweet Pink Tulip", price: 2.0, img: "img/Single Sweet Pink Tulip.jpg" },
  { id: "3", name: "Pure White Tulip Bouquet", price: 10.0, img: "img/Pure White Tulip Bouquet.jpg" },
  { id: "4", name: "Golden Sun Lily & Bells", price: 9.0, img: "img/Golden Sun Lily.jpg" },
  { id: "5", name: "Classic Coral Rose Twist", price: 12.0, img: "img/Rose.jpg" },
  { id: "6", name: "Elegant Pastel Tulip Bundle", price: 7.0, img: "img/pink tulip.jpg" },
  { id: "7", name: "Ocean Sunset Ranunculus", price: 6.5, img: "img/Ocean Sunset ranunculus.jpg" },
  { id: "8", name: "Puppy Bouquet", price: 8.6, img: "img/Puppy Bouquet.jpg" },
  { id: "9", name: "Pink Lotus Bouquet", price: 3.0, img: "img/Pink Lotus Bouquet.jpg" },
  { id: "10", name: "Lilac & White WildFlower Bouquet", price: 3.5, img: "img/Lilac & White Wildflower Bouquet.jpg" },
  { id: "11", name: "Vibrant Coral & Blue Bouquet", price: 3.5, img: "img/Vibrant Coral & Blue Bouquet.jpg" },
  { id: "12", name: "Peach Rose & Blue Tweedia Bouquet", price: 5.0, img: "img/Peach Rose & Blue Tweedia Bouque.jpg" },
];

const initialServices = [
  { id: "s1", title: "Wedding & Event Floral Design", description: "Custom bridal bouquets, centerpieces, and full venue installations.", price: "From $150" },
  { id: "s2", title: "Custom Gift Wrapping & Tags", description: "Personalized ribbon printing, luxury wrapping paper, and handwritten cards.", price: "From $5" },
  { id: "s3", title: "Express Same-Day Delivery", description: "Guaranteed fast delivery across Phnom Penh within 2 hours.", price: "$3.00" },
  { id: "s4", title: "Monthly Flower Subscription", description: "Receive fresh seasonal blooms delivered to your home or office weekly.", price: "$40/month" },
];

function firebaseErrorMessage(error) {
  const code = error?.code || "";
  const messages = {
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/invalid-login-credentials": "Incorrect email or password.",
    "auth/user-not-found": "No account exists with this email.",
    "auth/wrong-password": "Incorrect email or password.",
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/too-many-requests": "Too many attempts. Please wait and try again.",
    "auth/network-request-failed": "Network error. Check your internet connection.",
    "auth/operation-not-allowed": "Email/password sign-in is disabled in Firebase Authentication.",
  };
  return messages[code] || error?.message || "Something went wrong. Please try again.";
}

export default function App() {
  const [products, setProducts] = useState(initialProducts);
  const [services, setServices] = useState(initialServices);

  // Cart now stores actual products and quantities instead of only a number.
  const [cart, setCart] = useState([]);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState("home");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  const [orders, setOrders] = useState([]);
  const [orderMessage, setOrderMessage] = useState("");
  const [orderError, setOrderError] = useState("");

  const [newProductName, setNewProductName] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newProductImg, setNewProductImg] = useState("");

  const [newServiceTitle, setNewServiceTitle] = useState("");
  const [newServiceDesc, setNewServiceDesc] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");

  const isAdmin = profile?.role === "admin";

  // Firebase Authentication listener.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      if (!currentUser) {
        setProfile(null);
        setOrders([]);
        return;
      }

      try {
        const profileSnap = await getDoc(doc(db, "users", currentUser.uid));
        setProfile(
          profileSnap.exists()
            ? profileSnap.data()
            : { email: currentUser.email, role: "user" }
        );
      } catch (error) {
        console.error("Could not load user profile:", error);
        setProfile({ email: currentUser.email, role: "user" });
      }
    });

    return () => unsubscribe();
  }, []);

  // Products are public-read. If Firestore is empty, the demo products remain visible.
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "products"),
      (snapshot) => {
        if (!snapshot.empty) {
          setProducts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        }
      },
      (error) => console.error("Products listener:", error)
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "services"),
      (snapshot) => {
        if (!snapshot.empty) {
          setServices(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        }
      },
      (error) => console.error("Services listener:", error)
    );
    return () => unsubscribe();
  }, []);

  // Load only this customer's orders. Admins get all orders for the dashboard.
  useEffect(() => {
    if (!user) {
      setOrders([]);
      return undefined;
    }

    const ordersQuery = isAdmin
      ? collection(db, "orders")
      : query(collection(db, "orders"), where("userId", "==", user.uid));

    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const loaded = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        loaded.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });

        setOrders(loaded);
      },
      (error) => {
        console.error("Orders listener:", error);
        setOrderError("Unable to load orders. Check your Firestore security rules.");
      }
    );

    return () => unsubscribe();
  }, [user, isAdmin]);

  const customerStats = useMemo(() => {
    const purchasedProducts = orders.reduce(
      (sum, order) =>
        sum + (order.items || []).reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0),
      0
    );
    const spent = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    return { orderCount: orders.length, purchasedProducts, spent };
  }, [orders]);

  const adminStats = useMemo(() => {
    const customers = new Set(orders.map((order) => order.userId).filter(Boolean));
    const units = orders.reduce(
      (sum, order) =>
        sum + (order.items || []).reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0),
      0
    );
    const revenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    return { customers: customers.size, orders: orders.length, units, revenue };
  }, [orders]);

  const addToCart = (product) => {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...current, { ...product, quantity: 1 }];
    });
    setOrderMessage(`${product.name} added to cart.`);
    setOrderError("");
  };

  const changeQuantity = (productId, amount) => {
    setCart((current) =>
      current
        .map((item) =>
          item.id === productId
            ? { ...item, quantity: Math.max(0, item.quantity + amount) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const clearCart = () => setCart([]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthMessage("");

    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const profileSnap = await getDoc(doc(db, "users", credential.user.uid));
      const role = profileSnap.exists() ? profileSnap.data().role : "user";

      setProfile(profileSnap.exists() ? profileSnap.data() : { email: credential.user.email, role: "user" });
      setEmail("");
      setPassword("");
      setView(role === "admin" ? "admin" : "account");
    } catch (error) {
      console.error("Login error:", error);
      setAuthError(firebaseErrorMessage(error));
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthMessage("");

    if (password.length < 6) {
      setAuthError("Password must be at least 6 characters.");
      return;
    }

    try {
      // IMPORTANT: every new account starts as "user".
      // Admin access must be granted separately in Firestore by the site owner.
      const credential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      await setDoc(doc(db, "users", credential.user.uid), {
        email: credential.user.email,
        role: "user",
        createdAt: serverTimestamp(),
      });

      try {
        await sendEmailVerification(credential.user);
      } catch (verificationError) {
        console.warn("Verification email could not be sent:", verificationError);
      }

      setProfile({ email: credential.user.email, role: "user" });
      setEmail("");
      setPassword("");
      setAuthMessage("Account created. A verification email was sent if email verification is enabled.");
      setView("account");
    } catch (error) {
      console.error("Register error:", error);
      setAuthError(firebaseErrorMessage(error));
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthMessage("");

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setAuthMessage("Password reset email sent. Check your inbox.");
    } catch (error) {
      setAuthError(firebaseErrorMessage(error));
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setProfile(null);
    setView("home");
    setAuthMessage("");
    setAuthError("");
  };

  const handleCheckout = async () => {
    setOrderMessage("");
    setOrderError("");

    if (!user) {
      setOrderError("Please sign in before checking out.");
      setView("login");
      return;
    }

    if (!cart.length) {
      setOrderError("Your cart is empty.");
      return;
    }

    if (!user.emailVerified) {
      setOrderError("Please verify your email before placing an order.");
      return;
    }

    try {
      const items = cart.map((item) => ({
        productId: item.id,
        name: item.name,
        price: Number(item.price),
        quantity: Number(item.quantity),
        subtotal: Number(item.price) * Number(item.quantity),
      }));

      await addDoc(collection(db, "orders"), {
        userId: user.uid,
        customerEmail: user.email,
        items,
        total: Number(cartTotal.toFixed(2)),
        status: "placed",
        createdAt: serverTimestamp(),
      });

      setCart([]);
      setOrderMessage("Order placed successfully!");
      setView("account");
    } catch (error) {
      console.error("Checkout error:", error);
      setOrderError("Could not place the order. Check your Firestore security rules.");
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!isAdmin || !newProductName || !newProductPrice) return;

    try {
      await addDoc(collection(db, "products"), {
        name: newProductName.trim(),
        price: Number(newProductPrice),
        img: newProductImg.trim() || "img/pink tulip.jpg",
      });
      setNewProductName("");
      setNewProductPrice("");
      setNewProductImg("");
    } catch (error) {
      console.error("Add product:", error);
      setAuthError("Only an admin can add products.");
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, "products", id));
    } catch (error) {
      console.error("Delete product:", error);
    }
  };

  const handleAddService = async (e) => {
    e.preventDefault();
    if (!isAdmin || !newServiceTitle || !newServiceDesc) return;

    try {
      await addDoc(collection(db, "services"), {
        title: newServiceTitle.trim(),
        description: newServiceDesc.trim(),
        price: newServicePrice.trim() || "Standard Rate",
      });
      setNewServiceTitle("");
      setNewServiceDesc("");
      setNewServicePrice("");
    } catch (error) {
      console.error("Add service:", error);
    }
  };

  const handleDeleteService = async (id) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, "services", id));
    } catch (error) {
      console.error("Delete service:", error);
    }
  };

  if (authLoading) {
    return <div style={{ padding: 50, textAlign: "center" }}>Loading...</div>;
  }

  return (
    <div>
      <header className="navbar">
        <div className="logo" onClick={() => setView("home")} style={{ cursor: "pointer" }}>
          Kia <span>Flora</span>
        </div>

        <nav>
          <ul>
            {[
              ["home", "Home"],
              ["products", "Products"],
              ["services", "Services"],
              ["about", "About Us"],
              ["contact", "Contact Us"],
            ].map(([key, label]) => (
              <li key={key}>
                <button
                  className={view === key ? "active-link" : "btn-link"}
                  onClick={() => setView(key)}
                >
                  {label}
                </button>
              </li>
            ))}

            {user ? (
              <>
                <li>
                  <button
                    className={view === "account" ? "active-link" : "btn-link"}
                    onClick={() => setView("account")}
                  >
                    My Account
                  </button>
                </li>

                {isAdmin && (
                  <li>
                    <button
                      className={view === "admin" ? "active-link" : "btn-link"}
                      onClick={() => setView("admin")}
                    >
                      Admin Dashboard
                    </button>
                  </li>
                )}

                <li>
                  <button className="btn-link" onClick={handleLogout}>
                    Logout
                  </button>
                </li>
              </>
            ) : (
              <li>
                <button
                  className={view === "login" ? "active-link" : "btn-link"}
                  onClick={() => setView("login")}
                >
                  Login / Register
                </button>
              </li>
            )}
          </ul>
        </nav>

        <div className="nav-icons">
          <button
            type="button"
            className="btn-link"
            onClick={() => setView("cart")}
            title="Open cart"
          >
            🛒 <span className="cart-count">{cartCount}</span>
          </button>
        </div>
      </header>

      {view === "home" && (
        <section className="hero">
          <div className="hero-content">
            <h1>Welcome to Kia Flora Flowers Shop</h1>
            <p>Fresh, elegant, and uniquely designed floral arrangements delivered straight to your door.</p>
            <button className="btn" onClick={() => setView("products")}>Explore Collection</button>
          </div>
          <div className="features" style={{ marginTop: "40px" }}>
            <div className="feature-item"><h3>🚚 Free Delivery</h3><p>On all local orders over $30</p></div>
            <div className="feature-item"><h3>🌸 Fresh Flowers</h3><p>100% locally sourced daily</p></div>
            <div className="feature-item"><h3>💝 Custom Styling</h3><p>Personalized tags & wrapping</p></div>
          </div>
        </section>
      )}

      {view === "products" && (
        <section className="shop-section" style={{ padding: "40px 20px" }}>
          <h2 className="section-title">Our Signature Flower Collection</h2>
          <p className="section-subtitle">Click any arrangement to add it to your cart.</p>
          <div className="product-grid">
            {products.map((item) => (
              <div key={item.id} className="product-card">
                <div className="product-img-container">
                  <img src={item.img} alt={item.name} />
                </div>
                <div className="product-info">
                  <h3>{item.name}</h3>
                  <p className="price">${Number(item.price).toFixed(2)}</p>
                  <button className="add-to-cart" onClick={() => addToCart(item)}>Add to Cart</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {view === "cart" && (
        <section style={{ padding: "40px 20px", maxWidth: 900, margin: "auto" }}>
          <h2>Your Cart</h2>

          {orderMessage && <p style={{ color: "green" }}>{orderMessage}</p>}
          {orderError && <p style={{ color: "red" }}>{orderError}</p>}

          {!cart.length ? (
            <p>Your cart is empty. <button onClick={() => setView("products")}>Shop now</button></p>
          ) : (
            <>
              {cart.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 20,
                    padding: "15px 0",
                    borderBottom: "1px solid #ddd",
                  }}
                >
                  <div>
                    <strong>{item.name}</strong>
                    <div>${Number(item.price).toFixed(2)} each</div>
                  </div>
                  <div>
                    <button onClick={() => changeQuantity(item.id, -1)}>-</button>
                    <span style={{ margin: "0 12px" }}>{item.quantity}</span>
                    <button onClick={() => changeQuantity(item.id, 1)}>+</button>
                  </div>
                  <strong>${(Number(item.price) * item.quantity).toFixed(2)}</strong>
                </div>
              ))}

              <h3 style={{ textAlign: "right" }}>Total: ${cartTotal.toFixed(2)}</h3>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button className="btn-link" onClick={clearCart}>Clear Cart</button>
                <button className="btn btn-dark" onClick={handleCheckout}>Checkout</button>
              </div>
            </>
          )}
        </section>
      )}

      {view === "services" && (
        <section className="services-section" style={{ padding: "50px 20px", minHeight: "60vh" }}>
          <h2 className="section-title" style={{ textAlign: "center" }}>Our Special Services</h2>
          <p className="section-subtitle" style={{ textAlign: "center", marginBottom: 30 }}>
            We offer bespoke floral solutions tailored for your requirements.
          </p>
          <div className="services-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 20, maxWidth: 1200, margin: "0 auto" }}>
            {services.map((srv) => (
              <div key={srv.id} className="service-card" style={{ background: "#fff", padding: 20, borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", textAlign: "center" }}>
                <h3 style={{ color: "#d47a8f" }}>{srv.title}</h3>
                <p style={{ margin: "15px 0", color: "#555" }}>{srv.description}</p>
                <span style={{ fontWeight: "bold", color: "#333", fontSize: "1.1rem" }}>{srv.price}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {view === "about" && (
        <section className="about-section" style={{ padding: "40px 20px" }}>
          <div className="about-content" style={{ maxWidth: 800, margin: "0 auto 40px auto" }}>
            <h2>About Us</h2>
            <p>Kia Flora Shop is a demo website created by 29.Soeum Kimseang (ITE Student Class A4).</p>
            <p>
              At Kia Flora, we believe flowers are more than just a gift—it's an elegant language of love,
              celebration, and connection. Our boutique carefully curates each stem.
            </p>
          </div>
          <div className="reviews">
            <h2>What Our Customers Say</h2>
            <div className="review-container">
              <div className="review-box"><p className="stars">⭐️⭐️⭐️⭐️⭐️</p><p>"The single pink tulip with the bows is so cute omg I love it!"</p><h4>- Miss. Mey Mey</h4></div>
              <div className="review-box"><p className="stars">⭐️⭐️⭐️⭐️⭐️</p><p>"The Peach Rose & Blue Tweedia Bouquet is gorgeous!"</p><h4>- Miss. LyLy</h4></div>
            </div>
          </div>
        </section>
      )}

      {view === "contact" && (
        <section className="contact-section" style={{ padding: "40px 20px" }}>
          <div className="contact-container">
            <div className="contact-info">
              <h2>Contact Us</h2>
              <p>Have questions about custom arrangements, wedding packages, or delivery schedules? Send us a message!</p>
              <ul>
                <li>📍 St 315 Toul Kork District, Phnom Penh, Cambodia</li>
                <li>📞 +855 89416064</li>
                <li>✉️ Kia123@gmail.com</li>
              </ul>
            </div>
            <div className="contact-form">
              <form onSubmit={(e) => { e.preventDefault(); alert("Message sent successfully!"); }}>
                <div className="form-group"><input type="text" placeholder="Your Name" required /></div>
                <div className="form-group"><input type="email" placeholder="Your Email" required /></div>
                <div className="form-group"><textarea placeholder="Your Message" rows="5" required /></div>
                <button type="submit" className="btn btn-dark">Send Message</button>
              </form>
            </div>
          </div>
        </section>
      )}

      {view === "login" && (
        <section className="auth-section" style={{ padding: 40 }}>
          <h2>Login</h2>
          {authError && <p style={{ color: "red" }}>{authError}</p>}
          {authMessage && <p style={{ color: "green" }}>{authMessage}</p>}
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 350 }}>
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            <button type="submit" className="btn btn-dark">Sign In</button>
          </form>
          <p>New here? <button onClick={() => { setAuthError(""); setAuthMessage(""); setView("register"); }}>Create an account</button></p>
          <p>Forgot password? <button onClick={() => { setAuthError(""); setAuthMessage(""); setView("forgot"); }}>Reset it</button></p>
        </section>
      )}

      {view === "register" && (
        <section className="auth-section" style={{ padding: 40 }}>
          <h2>Create Account</h2>
          <p>Create a customer account. New accounts are not automatically admins.</p>
          {authError && <p style={{ color: "red" }}>{authError}</p>}
          {authMessage && <p style={{ color: "green" }}>{authMessage}</p>}
          <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 350 }}>
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            <input type="password" placeholder="Password (minimum 6 characters)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={6} required />
            <button type="submit" className="btn">Register</button>
          </form>
          <p>Already have an account? <button onClick={() => setView("login")}>Login</button></p>
        </section>
      )}

      {view === "forgot" && (
        <section className="auth-section" style={{ padding: 40 }}>
          <h2>Reset Password</h2>
          {authError && <p style={{ color: "red" }}>{authError}</p>}
          {authMessage && <p style={{ color: "green" }}>{authMessage}</p>}
          <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 350 }}>
            <input type="email" placeholder="Your account email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <button type="submit" className="btn btn-dark">Send Reset Email</button>
          </form>
          <p><button onClick={() => setView("login")}>Back to Login</button></p>
        </section>
      )}

      {view === "account" && user && (
        <section style={{ padding: "40px 20px", maxWidth: 1100, margin: "auto" }}>
          <h2>My Account</h2>
          <p>Signed in as <strong>{user.email}</strong></p>
          <p>
            Account type: <strong>{isAdmin ? "Admin" : "Customer"}</strong>{" "}
            {!user.emailVerified && <span style={{ color: "#b35b00" }}>• Email not verified</span>}
          </p>

          {authMessage && <p style={{ color: "green" }}>{authMessage}</p>}
          {orderError && <p style={{ color: "red" }}>{orderError}</p>}

          <div className="features" style={{ margin: "25px 0" }}>
            <div className="feature-item"><h3>{customerStats.purchasedProducts}</h3><p>Products purchased</p></div>
            <div className="feature-item"><h3>{customerStats.orderCount}</h3><p>Orders placed</p></div>
            <div className="feature-item"><h3>${customerStats.spent.toFixed(2)}</h3><p>Total spent</p></div>
          </div>

          <h3>Order History</h3>
          {!orders.length ? (
            <p>You haven't purchased anything yet.</p>
          ) : (
            orders.map((order) => (
              <div key={order.id} style={{ border: "1px solid #ddd", padding: 15, marginBottom: 12, borderRadius: 8 }}>
                <strong>Order #{order.id.slice(0, 8)}</strong>
                <span style={{ marginLeft: 15 }}>Status: {order.status}</span>
                <p>Total: ${Number(order.total || 0).toFixed(2)}</p>
                <ul>
                  {(order.items || []).map((item, index) => (
                    <li key={`${order.id}-${index}`}>
                      {item.name} × {item.quantity} — ${(Number(item.subtotal || 0)).toFixed(2)}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}

          <button className="btn" onClick={() => setView("products")}>Continue Shopping</button>
        </section>
      )}

      {view === "admin" && user && isAdmin && (
        <section className="admin-dashboard" style={{ padding: "40px 20px", maxWidth: 1200, margin: "auto" }}>
          <h2>Admin Dashboard</h2>
          <p>Signed in as {user.email}</p>

          <div className="features" style={{ margin: "25px 0" }}>
            <div className="feature-item"><h3>{adminStats.customers}</h3><p>Customers</p></div>
            <div className="feature-item"><h3>{adminStats.orders}</h3><p>Orders</p></div>
            <div className="feature-item"><h3>{adminStats.units}</h3><p>Products sold</p></div>
            <div className="feature-item"><h3>${adminStats.revenue.toFixed(2)}</h3><p>Revenue</p></div>
          </div>

          <hr />

          <div className="add-product-form">
            <h3>Add New Product</h3>
            <form onSubmit={handleAddProduct}>
              <input type="text" placeholder="Product Name" value={newProductName} onChange={(e) => setNewProductName(e.target.value)} required />
              <input type="number" min="0" step="0.01" placeholder="Price" value={newProductPrice} onChange={(e) => setNewProductPrice(e.target.value)} required />
              <input type="text" placeholder="Image Filename" value={newProductImg} onChange={(e) => setNewProductImg(e.target.value)} />
              <button type="submit" className="btn">Add Product</button>
            </form>
          </div>

          <h3>Manage Products</h3>
          <ul className="admin-product-list">
            {products.map((p) => (
              <li key={p.id}>
                <span><strong>{p.name}</strong> - ${Number(p.price).toFixed(2)}</span>
                <button onClick={() => handleDeleteProduct(p.id)} style={{ color: "red", marginLeft: 10 }}>Delete</button>
              </li>
            ))}
          </ul>

          <hr style={{ margin: "30px 0" }} />

          <div className="add-service-form">
            <h3>Add New Service</h3>
            <form onSubmit={handleAddService}>
              <input type="text" placeholder="Service Title" value={newServiceTitle} onChange={(e) => setNewServiceTitle(e.target.value)} required />
              <input type="text" placeholder="Description" value={newServiceDesc} onChange={(e) => setNewServiceDesc(e.target.value)} required />
              <input type="text" placeholder="Price / Rate" value={newServicePrice} onChange={(e) => setNewServicePrice(e.target.value)} />
              <button type="submit" className="btn">Add Service</button>
            </form>
          </div>

          <h3>Manage Services</h3>
          <ul className="admin-product-list">
            {services.map((s) => (
              <li key={s.id}>
                <span><strong>{s.title}</strong> ({s.price}) - <em>{s.description}</em></span>
                <button onClick={() => handleDeleteService(s.id)} style={{ color: "red", marginLeft: 10 }}>Delete</button>
              </li>
            ))}
          </ul>

          <hr style={{ margin: "30px 0" }} />
          <h3>Recent Orders</h3>
          {!orders.length ? (
            <p>No orders yet.</p>
          ) : (
            orders.slice(0, 20).map((order) => (
              <div key={order.id} style={{ border: "1px solid #ddd", padding: 15, marginBottom: 10, borderRadius: 8 }}>
                <strong>#{order.id.slice(0, 8)}</strong> — {order.customerEmail} — ${Number(order.total || 0).toFixed(2)}
                <ul>
                  {(order.items || []).map((item, index) => (
                    <li key={`${order.id}-${index}`}>{item.name} × {item.quantity}</li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      )}

      {view === "admin" && user && !isAdmin && (
        <section style={{ padding: 40 }}>
          <h2>Access denied</h2>
          <p>Your account is a customer account, not an administrator.</p>
          <button className="btn" onClick={() => setView("account")}>Go to My Account</button>
        </section>
      )}

      {["home", "products", "services", "about", "contact"].includes(view) && (
        <footer>
          <p>&copy; 2026 Kia Flora Boutique. All Rights Reserved.</p>
        </footer>
      )}
    </div>
  );
}