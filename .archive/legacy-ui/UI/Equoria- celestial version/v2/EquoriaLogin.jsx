import { useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FaFacebookF, FaGoogle, FaTwitter } from "react-icons/fa";
import "./styles.css";
export default function EquoriaLogin() {
  const containerRef = useRef(null);
  useEffect(() => {
    const handleMouseMove = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 10;
      const y = (e.clientY / window.innerHeight - 0.5) * 10;
      if (containerRef.current) {
        containerRef.current.style.transform = `translate(${x}px, ${y}px)`;
      }
    };
    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, []);
  return (
    <div className="equoria-bg">
      <div className="starfield" />
      <div className="constellations" />
      <div className="horse-silhouettes" />
      <div className="login-container" ref={containerRef}>
        <h1 className="equoria-title">EQUORIA</h1>
        <Card className="glass-card">
          <CardContent className="form-content">
            <Input placeholder="Username or Email" className="magic-input" />
            <Input
              type="password"
              placeholder="Password"
              className="magic-input"
            />
            <div className="forgot-password">Forgot Password?</div>
            <Button className="magic-button login">Login</Button>
            <Button variant="ghost" className="magic-button register">
              Register
            </Button>
          </CardContent>
        </Card>
        <div className="social-icons">
          <FaFacebookF className="social-icon" />
          <FaGoogle className="social-icon" />
          <FaTwitter className="social-icon" />
        </div>
        <p className="version">Version 1.0</p>
      </div>
    </div>
  );
}
