'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getApiUrl } from './utils/apiUrl';

interface LoginResponse {
  success: boolean;
  user?: {
    id: number;
    name: string;
    role: 'Admin' | 'Tutor' | 'Manager' | 'Student' | 'Moderator';
  };
  token?: string;
  message?: string;
}

const LoginPage = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isFocused, setIsFocused] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [particleSystem, setParticleSystem] = useState<any[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Advanced particle system with physics
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
      size: number;
      color: string;
      type: 'sparkle' | 'glow' | 'trail';

      constructor(x: number, y: number, type: 'sparkle' | 'glow' | 'trail' = 'glow') {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4;
        this.maxLife = Math.random() * 100 + 50;
        this.life = this.maxLife;
        this.size = Math.random() * 4 + 1;
        this.type = type;
        this.color = type === 'sparkle' ? '#FFFFFF' : 
                    type === 'trail' ? '#11CCEF' : 
                    ['#11CCEF', '#E51791', '#12B7F3'][Math.floor(Math.random() * 3)];
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.05; // gravity
        this.life--;
        
        if (this.type === 'sparkle') {
          this.vx *= 0.98;
          this.vy *= 0.98;
        }
      }

      // Helper function to convert hex to rgba
      hexToRgba(hex: string, alpha: number): string {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }

      draw(ctx: CanvasRenderingContext2D) {
        const alpha = this.life / this.maxLife;
        
        if (this.type === 'sparkle') {
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = this.color;
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          const gradient = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, this.size * 2
          );
          gradient.addColorStop(0, this.hexToRgba(this.color, alpha));
          gradient.addColorStop(1, this.hexToRgba(this.color, 0));
          
          ctx.fillStyle = gradient;
          ctx.fillRect(this.x - this.size * 2, this.y - this.size * 2, this.size * 4, this.size * 4);
        }
      }

      isDead() {
        return this.life <= 0;
      }
    }

    const particles: Particle[] = [];
    const connectionDistance = 120;

    // Create initial particles
    for (let i = 0; i < 80; i++) {
      particles.push(new Particle(
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        Math.random() > 0.7 ? 'sparkle' : 'glow'
      ));
    }

    const animate = () => {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add new particles occasionally
      if (Math.random() < 0.1) {
        particles.push(new Particle(
          Math.random() * canvas.width,
          Math.random() * canvas.height,
          Math.random() > 0.8 ? 'sparkle' : 'glow'
        ));
      }

      // Update and draw particles
      particles.forEach((particle, index) => {
        particle.update();
        particle.draw(ctx);

        // Remove dead particles
        if (particle.isDead()) {
          particles.splice(index, 1);
        }
      });

      // Draw connections
      particles.forEach((particle, i) => {
        particles.forEach((otherParticle, j) => {
          if (i !== j) {
            const dx = particle.x - otherParticle.x;
            const dy = particle.y - otherParticle.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < connectionDistance) {
              const alpha = (1 - distance / connectionDistance) * 0.3;
              ctx.strokeStyle = `rgba(17, 204, 239, ${alpha})`;
              ctx.lineWidth = 0.5;
              ctx.beginPath();
              ctx.moveTo(particle.x, particle.y);
              ctx.lineTo(otherParticle.x, otherParticle.y);
              ctx.stroke();
            }
          }
        });
      });

      requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mouse trail effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Audio feedback (subtle)
  const playClickSound = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const oscillator = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);

    oscillator.frequency.setValueAtTime(800, audioContextRef.current.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(400, audioContextRef.current.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.1, audioContextRef.current.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + 0.1);

    oscillator.start(audioContextRef.current.currentTime);
    oscillator.stop(audioContextRef.current.currentTime + 0.1);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    await playClickSound();

    try {
      const apiUrl = getApiUrl();
      
      const res = await fetch(`${apiUrl}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data: LoginResponse = await res.json();

      if (data.success && data.user) {
        localStorage.setItem('lms-user', JSON.stringify(data.user));
        localStorage.setItem('lms-token', data.token || '');

        window.dispatchEvent(new Event('login'));
        window.dispatchEvent(new Event('auth-change'));

        // Keep loading state active while redirecting
        setTimeout(() => {
          switch (data.user!.role) {
            case 'Admin':
              router.push('/dashboard/admin');
              break;
            case 'Tutor':
              router.push('/dashboard/tutor');
              break;
            case 'Manager':
              router.push('/dashboard/manager');
              break;
            case 'Student':
              router.push('/dashboard/student');
              break;
            case 'Moderator':
              router.push('/dashboard/moderator');
              break;
            default:
              router.push('/');
          }
        }, 800);
        // Don't set loading to false here - keep the animation running until navigation completes
      } else {
        setError(data.message || 'Invalid credentials');
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError('Something went wrong. Try again.');
      setLoading(false);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden"
      style={{ height: '100vh' }}
    >
      {/* Advanced Animated Background */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
      
      {/* Interactive Floating Elements - Responsive Sizes */}
      <div className="absolute top-1/4 left-1/4 w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 bg-gradient-to-br from-[#11CCEF] to-[#E51791] rounded-full filter blur-3xl opacity-20 animate-float-slow hover:opacity-30 transition-opacity duration-1000"></div>
      <div className="absolute bottom-1/4 right-1/4 w-36 h-36 sm:w-44 sm:h-44 md:w-56 md:h-56 bg-gradient-to-tr from-[#E51791] to-[#12B7F3] rounded-full filter blur-3xl opacity-25 animate-float-delayed hover:opacity-35 transition-opacity duration-1000"></div>
      <div className="absolute top-1/2 right-1/3 w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 bg-[#12B7F3] rounded-full filter blur-3xl opacity-20 animate-pulse-slow"></div>

      {/* Mouse Tracker - Hidden on touch devices */}
      <div 
        className="hidden md:block absolute w-6 h-6 pointer-events-none z-50 transition-transform duration-100"
        style={{
          left: mousePosition.x - 12,
          top: mousePosition.y - 12,
          transform: 'translate(-50%, -50%)'
        }}
      >
        <div className="w-full h-full bg-[#11CCEF] rounded-full opacity-20 animate-ping"></div>
      </div>

      <div className="relative w-full max-w-6xl mx-4 md:mx-8 flex flex-col lg:flex-row items-center justify-center">
        {/* Enhanced Left Side - Immersive Experience */}
        <div className="flex-1 hidden lg:flex flex-col justify-center p-6 lg:p-8 text-white relative">
          <div className="max-w-lg relative">
            {/* Animated Background Card */}
            <div className="absolute -inset-6 lg:-inset-8 bg-gradient-to-br from-white/5 to-white/0 rounded-2xl lg:rounded-3xl backdrop-blur-xl border border-white/10 transform rotate-1 scale-105"></div>
            
            <div className="relative">
              {/* Animated Logo */}
              <div className="flex items-center gap-3 lg:gap-4 mb-4 lg:mb-6">
                <div className="relative">
                  <div className="w-10 h-10 lg:w-14 lg:h-14 bg-gradient-to-br from-[#11CCEF] via-[#E51791] to-[#12B7F3] rounded-xl lg:rounded-2xl flex items-center justify-center shadow-2xl animate-gradient-xy">
                    <svg className="w-5 h-5 lg:w-7 lg:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l9 5m-9-5v10" />
                    </svg>
                  </div>
                  <div className="absolute -inset-2 lg:-inset-3 bg-gradient-to-r from-[#11CCEF] to-[#E51791] rounded-xl lg:rounded-2xl blur-xl opacity-30 -z-10"></div>
                </div>
                <div>
                  <h1 className="text-2xl lg:text-3xl font-black bg-gradient-to-r from-[#11CCEF] via-[#E51791] to-[#12B7F3] bg-clip-text text-transparent animate-gradient">
                    Inspire LMS
                  </h1>
                  <p className="text-xs lg:text-sm text-gray-300 mt-1">Next Generation Learning Platform</p>
                </div>
              </div>
              
              {/* Main Heading */}
              <h2 className="text-3xl lg:text-4xl font-black mb-3 lg:mb-4 leading-tight">
                Welcome to{' '}
                <span className="bg-gradient-to-r from-[#11CCEF] via-[#E51791] to-[#12B7F3] bg-clip-text text-transparent animate-gradient">
                  Future Learning
                </span>
              </h2>
              
              <p className="text-base lg:text-lg text-gray-300 mb-4 lg:mb-6 leading-relaxed font-light">
                Experience education reimagined with AI-powered personalized learning paths and immersive virtual classrooms.
              </p>
              
              {/* Interactive Feature Cards */}
              <div className="grid grid-cols-2 gap-3 lg:gap-4 mb-6 lg:mb-8">
                {[
                  { icon: '🚀', title: 'AI Tutor', desc: '24/7 Personalized Assistance' },
                  { icon: '📊', title: 'Analytics', desc: 'Real-time Progress Tracking' },
                  { icon: '🌐', title: 'Global', desc: 'Connect with Learners Worldwide' },
                  { icon: '🎯', title: 'Goals', desc: 'Smart Achievement System' }
                ].map((feature, index) => (
                  <div 
                    key={index}
                    className="bg-white/5 backdrop-blur-sm rounded-lg lg:rounded-xl p-3 lg:p-4 border border-white/10 hover:border-[#11CCEF]/30 transition-all duration-500 hover:transform hover:scale-105 group cursor-pointer"
                  >
                    <div className="text-lg lg:text-xl mb-1 lg:mb-2 group-hover:scale-110 transition-transform duration-300">
                      {feature.icon}
                    </div>
                    <h3 className="font-bold text-white mb-1 text-xs lg:text-sm">{feature.title}</h3>
                    <p className="text-xs text-gray-400 leading-tight">{feature.desc}</p>
                  </div>
                ))}
              </div>

              {/* Stats */}
              <div className="flex gap-4 lg:gap-8 text-center">
                {[
                  { number: '50K+', label: 'Active Students' },
                  { number: '500+', label: 'Expert Tutors' },
                  { number: '98%', label: 'Success Rate' }
                ].map((stat, index) => (
                  <div key={index} className="flex-1">
                    <div className="text-xl lg:text-2xl font-bold text-[#11CCEF]">{stat.number}</div>
                    <div className="text-xs lg:text-sm text-gray-400">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Premium Right Side - Login Form */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8 w-full max-w-md lg:max-w-lg">
          <div className="w-full">
            {/* Glass Morphism Container with Advanced Effects */}
            <div className="relative">
              {/* Background Glow */}
              <div className="absolute -inset-3 sm:-inset-4 md:-inset-5 bg-gradient-to-r from-[#11CCEF] to-[#E51791] rounded-2xl sm:rounded-3xl blur-2xl opacity-20 animate-pulse"></div>
              
              {/* Main Card */}
              <div className="relative bg-white/10 backdrop-blur-2xl rounded-2xl sm:rounded-3xl border border-white/20 shadow-2xl p-5 sm:p-6 md:p-7 lg:p-8">
                {/* Mobile Header */}
                <div className="lg:hidden flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8 justify-center">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-gradient-to-br from-[#11CCEF] to-[#E51791] rounded-xl sm:rounded-2xl flex items-center justify-center shadow-2xl">
                    <svg className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-[#11CCEF] to-[#E51791] bg-clip-text text-transparent">
                      Inspire LMS
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-400">Next Generation Learning</p>
                  </div>
                </div>

                {/* Header */}
                <div className="text-center mb-5 sm:mb-6">
                  <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">Welcome Back</h2>
                  <p className="text-sm text-gray-300">Continue your learning journey</p>
                </div>

                {/* Error Message with Animation */}
                {error && (
                  <div className="mb-4 sm:mb-5 p-3 sm:p-4 bg-red-500/20 border border-red-500/30 rounded-xl sm:rounded-2xl flex items-center gap-3 backdrop-blur-sm animate-shake">
                    <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <span className="text-red-200 text-sm flex-1">{error}</span>
                  </div>
                )}

                {/* Enhanced Login Form - Added spacing between fields */}
                <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
                  {/* Email Field with increased spacing */}
                  <div className="relative group mb-6">
                    <label htmlFor="email" className="block text-sm font-bold text-white mb-3 uppercase tracking-wider">
                      Email Address
                    </label>
                    <div className={`relative transition-all duration-500 ${isFocused === 'email' ? 'transform scale-[1.02]' : ''}`}>
                      <input
                        type="email"
                        id="email"
                        className="w-full px-4 sm:px-5 py-3.5 sm:py-4 bg-white/5 border-2 border-white/10 rounded-xl sm:rounded-2xl focus:outline-none focus:border-[#11CCEF] transition-all duration-500 text-white placeholder-gray-400 backdrop-blur-sm group-hover:border-white/20 text-base sm:text-lg"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onFocus={() => setIsFocused('email')}
                        onBlur={() => setIsFocused('')}
                        required
                        placeholder="Enter your email"
                      />
                      <div className="absolute right-4 sm:right-5 top-1/2 transform -translate-y-1/2 transition-transform duration-300 group-hover:scale-110">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Password Field with increased spacing and visibility toggle */}
                  <div className="relative group mb-6">
                    <label htmlFor="password" className="block text-sm font-bold text-white mb-3 uppercase tracking-wider">
                      Password
                    </label>
                    <div className={`relative transition-all duration-500 ${isFocused === 'password' ? 'transform scale-[1.02]' : ''}`}>
                      <input
                        type={showPassword ? "text" : "password"}
                        id="password"
                        className="w-full px-4 sm:px-5 py-3.5 sm:py-4 pr-24 bg-white/5 border-2 border-white/10 rounded-xl sm:rounded-2xl focus:outline-none focus:border-[#11CCEF] transition-all duration-500 text-white placeholder-gray-400 backdrop-blur-sm group-hover:border-white/20 text-base sm:text-lg"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={() => setIsFocused('password')}
                        onBlur={() => setIsFocused('')}
                        required
                        placeholder="Enter your password"
                      />
                      <div className="absolute right-4 sm:right-5 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="p-1 hover:bg-white/10 rounded-lg transition-all duration-300 group/btn"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? (
                            <svg className="w-5 h-5 text-gray-400 group-hover/btn:text-[#11CCEF] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-gray-400 group-hover/btn:text-[#11CCEF] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Options */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-6">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input type="checkbox" className="sr-only" />
                        <div className="w-5 h-5 bg-white/10 border-2 border-white/20 rounded group-hover:border-[#11CCEF] transition-colors duration-300 flex items-center justify-center">
                          <svg className="w-3 h-3 text-[#11CCEF] opacity-0 transition-opacity duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                      <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Remember me</span>
                    </label>
                    <a href="#" className="text-sm text-[#11CCEF] hover:text-[#0daed9] transition-colors duration-300 font-semibold group">
                      Forgot password?
                      <span className="block h-0.5 bg-gradient-to-r from-[#11CCEF] to-[#E51791] scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></span>
                    </a>
                  </div>

                  {/* Enhanced Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full relative overflow-hidden group bg-gradient-to-r from-[#11CCEF] to-[#E51791] text-white py-4 sm:py-4.5 rounded-xl sm:rounded-2xl font-black text-base sm:text-lg shadow-2xl hover:shadow-3xl transform hover:scale-[1.02] transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none min-h-[56px]"
                  >
                    {/* Animated Background */}
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0daed9] to-[#c4127a] opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    
                    {/* Shine Effect */}
                    <div className="absolute inset-0 -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000">
                      <div className="w-1/2 h-full bg-white/20"></div>
                    </div>
                    
                    {/* Button Content */}
                    <span className="relative z-10 flex items-center justify-center gap-3">
                      {loading ? (
                        <>
                          <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-base">Authenticating...</span>
                        </>
                      ) : (
                        <>
                          <span className="text-base sm:text-lg">Access Your Dashboard</span>
                          <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </>
                      )}
                    </span>
                  </button>
                </form>

                {/* Enhanced Divider */}
                <div className="my-5 sm:my-6 flex items-center">
                  <div className="flex-1 border-t border-white/10"></div>
                  <span className="px-4 text-xs text-gray-400 font-semibold">OR CONTINUE WITH</span>
                  <div className="flex-1 border-t border-white/10"></div>
                </div>

                {/* Social Login Buttons */}
                <div className="grid grid-cols-2 gap-4 sm:gap-5">
                  {[
                    { name: 'Google', icon: '🔗', color: 'from-red-500 to-orange-500' },
                    { name: 'Microsoft', icon: 'Ⓜ️', color: 'from-blue-600 to-blue-400' }
                  ].map((social, index) => (
                    <button
                      key={index}
                      className="flex items-center justify-center gap-3 px-5 sm:px-6 py-3.5 sm:py-4 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl text-white hover:bg-white/10 transition-all duration-500 group hover:transform hover:scale-105 min-h-[56px]"
                    >
                      <span className="text-lg group-hover:scale-110 transition-transform duration-300">{social.icon}</span>
                      <span className="text-sm font-semibold group-hover:text-[#11CCEF] transition-colors">{social.name}</span>
                    </button>
                  ))}
                </div>

                {/* Enhanced Footer */}
                <div className="mt-7 sm:mt-8 pt-5 sm:pt-6 border-t border-white/10">
                  <p className="text-center text-sm text-gray-400">
                    New to Inspire LMS?{' '}
                    <a href="#" className="text-[#11CCEF] hover:text-[#0daed9] font-black transition-colors duration-300 group">
                      Start your journey
                      <span className="block h-0.5 bg-[#11CCEF] scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></span>
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced CSS Animations */}
      <style jsx>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) rotate(0deg) scale(1); }
          33% { transform: translateY(-30px) rotate(120deg) scale(1.1); }
          66% { transform: translateY(20px) rotate(240deg) scale(0.9); }
        }
        
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0px) rotate(0deg) scale(1); }
          25% { transform: translateY(40px) rotate(90deg) scale(1.05); }
          50% { transform: translateY(-20px) rotate(180deg) scale(0.95); }
          75% { transform: translateY(30px) rotate(270deg) scale(1.1); }
        }
        
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(1.1); }
        }
        
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        @keyframes gradient-xy {
          0%, 100% { background-position: 0% 0%; }
          25% { background-position: 100% 0%; }
          50% { background-position: 100% 100%; }
          75% { background-position: 0% 100%; }
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        
        .animate-float-slow {
          animation: float-slow 15s ease-in-out infinite;
        }
        
        .animate-float-delayed {
          animation: float-delayed 20s ease-in-out infinite;
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }
        
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
        
        .animate-gradient-xy {
          background-size: 200% 200%;
          animation: gradient-xy 4s ease infinite;
        }
        
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default LoginPage;