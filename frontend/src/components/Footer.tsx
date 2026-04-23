import { Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export function Footer() {
  const user = useAuthStore((state) => state.user);

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-col footer-col-left">
          <Link to="/" className="footer-logo">
            <img src="/logo.png" alt="Nande" />
          </Link>
          <p className="footer-tagline">Casa de Alfajores, Dulces y Chocolates</p>
        </div>

        <nav className="footer-col footer-col-center">
          <Link to="/" className="footer-link">Catalogo</Link>
          {!user ? <Link to="/login" className="footer-link">Iniciar Sesion</Link> : null}
          {!user ? <Link to="/registro" className="footer-link">Registrarse</Link> : null}
          {user?.rol === "cliente" ? <Link to="/cliente" className="footer-link">Mis Puntos</Link> : null}
          {user?.rol === "admin" ? <Link to="/admin" className="footer-link">Panel Admin</Link> : null}
          <Link to="/sobre-nosotros" className="footer-link">Sobre Nosotros</Link>
          <Link to="/terminos" className="footer-link">Terminos</Link>
        </nav>

        <div className="footer-col footer-col-right">
          <div className="footer-socials">
            <a href="https://wa.me/5493794632610" target="_blank" rel="noreferrer" className="social-btn" aria-label="WhatsApp">
              WhatsApp
            </a>
            <a href="https://www.instagram.com/alfajorescorrentinos/" target="_blank" rel="noreferrer" className="social-btn" aria-label="Instagram">
              Instagram
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
