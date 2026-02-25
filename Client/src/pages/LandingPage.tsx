import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Menu,
  X,
  ParkingCircle,
  Clock,
  Shield,
  MapPin,
  CheckCircle,
  Star,
  Users,
  Zap,
  ChevronRight,
  CreditCard,
  QrCode,
  Navigation,
} from 'lucide-react';

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface Step {
  number: string;
  title: string;
  description: string;
}

interface ParkingType {
  name: string;
  description: string;
  price: string;
  features: string[];
  image: string;
}

interface Testimonial {
  name: string;
  role: string;
  content: string;
  rating: number;
  avatar: string;
}

interface PricingPlan {
  name: string;
  price: string;
  period: string;
  features: string[];
  highlighted?: boolean;
}

const LandingPage: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features: Feature[] = [
    {
      icon: <Clock className="w-8 h-8" />,
      title: 'Real-Time Availability',
      description: 'See available parking spots instantly with live updates and reserve your space in seconds.',
    },
    {
      icon: <Navigation className="w-8 h-8" />,
      title: 'Smart Navigation',
      description: 'Get turn-by-turn directions to your reserved parking spot with integrated GPS guidance.',
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: 'Secure Parking',
      description: 'All parking facilities are monitored 24/7 with CCTV and security personnel.',
    },
    {
      icon: <CreditCard className="w-8 h-8" />,
      title: 'Cashless Payment',
      description: 'Pay seamlessly through the app with multiple payment options and automatic receipts.',
    },
    {
      icon: <QrCode className="w-8 h-8" />,
      title: 'QR Entry & Exit',
      description: 'Quick access with QR code scanning for hassle-free entry and exit from parking areas.',
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: 'Instant Booking',
      description: 'Reserve your parking spot in advance or find available spaces on-the-go.',
    },
  ];

  const steps: Step[] = [
    {
      number: '01',
      title: 'Find Your Spot',
      description: 'Search for parking near your destination and view real-time availability.',
    },
    {
      number: '02',
      title: 'Reserve & Pay',
      description: 'Select your parking duration and complete secure payment through the app.',
    },
    {
      number: '03',
      title: 'Navigate & Park',
      description: 'Follow GPS directions to your reserved spot and scan QR code to enter.',
    },
    {
      number: '04',
      title: 'Exit Seamlessly',
      description: 'Scan QR code to exit automatically when your parking session ends.',
    },
  ];

  const parkingTypes: ParkingType[] = [
    {
      name: 'Regular Parking',
      description: 'Convenient on-street parking in prime locations',
      price: 'KSh 500',
      features: ['Pay per hour', 'City center access', 'Mobile payment'],
      image: 'https://images.pexels.com/photos/753876/pexels-photo-753876.jpeg?auto=compress&cs=tinysrgb&w=800',
    },
    {
      name: 'Premium Parking',
      description: 'Protected parking with security and amenities',
      price: 'KSh 800',
      features: ['24/7 Security', 'Weather protected', 'EV charging', 'Car wash available'],
      image: 'https://images.pexels.com/photos/1004409/pexels-photo-1004409.jpeg?auto=compress&cs=tinysrgb&w=800',
    },
    {
      name: 'VIP Parking',
      description: 'Long-term parking near major airports',
      price: 'KSh 1500',
      features: ['Shuttle service', 'Valet option', 'Long-term rates', 'Premium security'],
      image: 'https://i.pinimg.com/1200x/06/46/bc/0646bc90973237a5a0c502e711db9091.jpg',
    },
  ];

  const testimonials: Testimonial[] = [
    {
      name: 'Sarah Johnson',
      role: 'Business Consultant',
      content: 'Finding parking downtown used to be a nightmare. Now I book ahead and always have a guaranteed spot near my office.',
      rating: 5,
      avatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=200',
    },
    {
      name: 'Michael Chen',
      role: 'Software Developer',
      content: 'The app is brilliant! Real-time availability and QR code entry make parking completely stress-free. Highly recommend!',
      rating: 5,
      avatar: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=200',
    },
    {
      name: 'Emma Williams',
      role: 'Marketing Manager',
      content: 'I saved so much time and money. The monthly subscription is perfect for my daily commute. Best parking solution ever!',
      rating: 5,
      avatar: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=200',
    },
  ];

  const pricingPlans: PricingPlan[] = [
    {
      name: 'Hourly',
      price: 'KSh 0',
      period: 'monthly fee',
      features: [
        'Pay per hour',
        'All parking locations',
        'Mobile payments',
        'No commitment',
      ],
    },
    {
      name: 'Monthly Pass',
      price: 'KSh 9,900',
      period: 'per month',
      features: [
        '20% discount on hourly rates',
        'Priority parking spots',
        'Free cancellation',
        'Reserved spot guarantee',
        'Multiple locations',
      ],
      highlighted: true,
    },
    {
      name: 'Business',
      price: 'Custom',
      period: 'pricing',
      features: [
        '30% discount on all parking',
        'Dedicated account manager',
        'Team management portal',
        'Invoice billing',
        'Analytics & reporting',
      ],
    },
  ];

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <ParkingCircle className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">ParkSmart</span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <button
                onClick={() => scrollToSection('home')}
                className="text-gray-700 hover:text-blue-600 transition-colors"
              >
                Home
              </button>
              <button
                onClick={() => scrollToSection('services')}
                className="text-gray-700 hover:text-blue-600 transition-colors"
              >
                Services
              </button>
              <button
                onClick={() => scrollToSection('about')}
                className="text-gray-700 hover:text-blue-600 transition-colors"
              >
                About
              </button>
              <button
                onClick={() => scrollToSection('pricing')}
                className="text-gray-700 hover:text-blue-600 transition-colors"
              >
                Pricing
              </button>
              <button
                onClick={() => scrollToSection('contact')}
                className="text-gray-700 hover:text-blue-600 transition-colors"
              >
                Contact
              </button>
              <Link
                to="/login"
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-block text-center"
              >
                Login
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-gray-700"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-gray-200">
              <div className="flex flex-col space-y-4">
                <button
                  onClick={() => scrollToSection('home')}
                  className="text-gray-700 hover:text-blue-600 transition-colors text-left"
                >
                  Home
                </button>
                <button
                  onClick={() => scrollToSection('services')}
                  className="text-gray-700 hover:text-blue-600 transition-colors text-left"
                >
                  Services
                </button>
                <button
                  onClick={() => scrollToSection('about')}
                  className="text-gray-700 hover:text-blue-600 transition-colors text-left"
                >
                  About
                </button>
                <button
                  onClick={() => scrollToSection('pricing')}
                  className="text-gray-700 hover:text-blue-600 transition-colors text-left"
                >
                  Pricing
                </button>
                <button
                  onClick={() => scrollToSection('contact')}
                  className="text-gray-700 hover:text-blue-600 transition-colors text-left"
                >
                  Contact
                </button>
                <Link
                  to="/login"
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-block text-center"
                >
                  Login
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="relative min-h-screen flex items-center px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 w-full h-full">
          <img
            src="https://images.pexels.com/photos/753876/pexels-photo-753876.jpeg?auto=compress&cs=tinysrgb&w=1920"
            alt="Parking background"
            className="w-full h-full object-cover"
          />
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/90 to-blue-800/80"></div>
        </div>

        {/* Floating Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-300/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto w-full">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              {/* Badge */}
              <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-2">
                <Zap className="w-4 h-4 text-yellow-300" />
                <span className="text-sm text-white font-medium">Now Available in 50+ Cities</span>
              </div>

              <h1 className="text-5xl lg:text-7xl font-bold text-white leading-tight">
                Smart Parking Made{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-cyan-300">Simple</span>
              </h1>
              <p className="text-xl text-blue-50 leading-relaxed">
                Never waste time searching for parking again. Find, reserve, and pay for parking spaces instantly with our smart booking system.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/login"
                  className="group bg-white text-blue-600 px-8 py-4 rounded-xl hover:bg-blue-50 transition-all transform hover:scale-105 shadow-2xl flex items-center justify-center font-semibold"
                >
                  Get Started
                  <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>
                <button className="border-2 border-white/50 text-white px-8 py-4 rounded-xl hover:bg-white/10 hover:border-white transition-all backdrop-blur-sm font-semibold">
                  Learn More
                </button>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-4 pt-4">
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 hover:bg-white/15 transition-all">
                  <div className="text-3xl font-bold text-white">100K+</div>
                  <div className="text-blue-100 text-sm">Happy Drivers</div>
                </div>
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 hover:bg-white/15 transition-all">
                  <div className="text-3xl font-bold text-white">5000+</div>
                  <div className="text-blue-100 text-sm">Parking Spots</div>
                </div>
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 hover:bg-white/15 transition-all">
                  <div className="flex items-center gap-1">
                    <div className="text-3xl font-bold text-white">4.8</div>
                    <Star className="w-5 h-5 text-yellow-300 fill-current" />
                  </div>
                  <div className="text-blue-100 text-sm">Rating</div>
                </div>
              </div>
            </div>

            <div className="relative hidden lg:block h-80">
              {/* 24/7 Feature Card (kept) */}
              <div className="absolute -top-6 -right-6 bg-white rounded-2xl p-4 shadow-xl">
                <div className="flex items-center space-x-3">
                  <div className="bg-green-100 p-3 rounded-xl">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">24/7</div>
                    <div className="text-xs text-gray-600">Available</div>
                  </div>
                </div>
              </div>

              {/* Save Time Card (kept) */}
              <div className="absolute -bottom-6 -left-6 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl p-4 shadow-xl">
                <div className="flex items-center space-x-3">
                  <div className="bg-white/20 p-3 rounded-xl">
                    <Clock className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="font-bold text-white">Save Time</div>
                    <div className="text-xs text-blue-100">Quick Booking</div>
                  </div>
                </div>
              </div>

              {/* Floating Badge (kept) */}
              <div className="absolute top-1/2 -left-12 bg-white rounded-2xl p-4 shadow-xl animate-bounce">
                <div className="flex items-center space-x-2">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <Shield className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 text-sm">Secure</div>
                    <div className="text-xs text-gray-600">Protected</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="services" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Why Choose ParkSmart</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              We provide the most convenient parking solution with smart technology and real-time availability
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="p-8 rounded-xl border border-gray-200 hover:border-blue-600 hover:shadow-lg transition-all group"
              >
                <div className="bg-blue-100 w-16 h-16 rounded-lg flex items-center justify-center mb-6 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Park your car in four simple steps
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                <div className="bg-white p-8 rounded-xl shadow-md hover:shadow-xl transition-shadow">
                  <div className="text-5xl font-bold text-blue-100 mb-4">{step.number}</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">{step.title}</h3>
                  <p className="text-gray-600">{step.description}</p>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                    <ChevronRight className="w-8 h-8 text-blue-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Car Fleet Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Parking Options</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Choose from various parking types to suit your needs and budget
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {parkingTypes.map((parking, index) => (
              <div
                key={index}
                className="rounded-xl overflow-hidden border border-gray-200 hover:shadow-xl transition-all group"
              >
                <div className="relative overflow-hidden">
                  <img
                    src={parking.image}
                    alt={parking.name}
                    className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute top-4 right-4 bg-white px-3 py-1 rounded-full text-sm font-semibold text-blue-600">
                    From {parking.price}/hr
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{parking.name}</h3>
                  <p className="text-gray-600 mb-4">{parking.description}</p>
                  <ul className="space-y-2 mb-6">
                    {parking.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center text-gray-700">
                        <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/login"
                    className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors inline-block text-center"
                  >
                    Book Now
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">What Our Customers Say</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Join thousands of satisfied drivers who trust ParkSmart
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white p-8 rounded-xl shadow-md hover:shadow-xl transition-shadow">
                <div className="flex items-center mb-4">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-700 mb-6 leading-relaxed">{testimonial.content}</p>
                <div className="flex items-center">
                  <img
                    src={testimonial.avatar}
                    alt={testimonial.name}
                    className="w-12 h-12 rounded-full object-cover mr-4"
                  />
                  <div>
                    <div className="font-semibold text-gray-900">{testimonial.name}</div>
                    <div className="text-sm text-gray-600">{testimonial.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Choose the plan that works best for you
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {pricingPlans.map((plan, index) => (
              <div
                key={index}
                className={`rounded-xl p-8 border-2 transition-all hover:scale-105 ${
                  plan.highlighted
                    ? 'border-blue-600 shadow-xl bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-blue-300'
                }`}
              >
                {plan.highlighted && (
                  <div className="bg-blue-600 text-white text-sm font-semibold px-4 py-1 rounded-full inline-block mb-4">
                    Most Popular
                  </div>
                )}
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-gray-600 ml-2">{plan.period}</span>
                </div>
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                {/* Removed 'Get Started' button as requested */}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 px-4 sm:px-6 lg:px-8 bg-blue-600 text-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold mb-6">About ParkSmart</h2>
              <p className="text-lg mb-6 text-blue-100 leading-relaxed">
                Founded in 2020, ParkSmart has revolutionized urban parking with smart technology and data-driven solutions. We believe parking should be stress-free, accessible, and affordable for everyone.
              </p>
              <p className="text-lg mb-8 text-blue-100 leading-relaxed">
                Our mission is to eliminate parking hassles and save drivers time and money. With over 100,000 satisfied customers and 5,000+ parking spots across major cities, we're transforming the parking experience.
              </p>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <Users className="w-10 h-10 mb-2" />
                  <div className="text-2xl font-bold">100K+</div>
                  <div className="text-blue-100">Drivers</div>
                </div>
                <div>
                  <ParkingCircle className="w-10 h-10 mb-2" />
                  <div className="text-2xl font-bold">5000+</div>
                  <div className="text-blue-100">Parking Spots</div>
                </div>
                <div>
                  <MapPin className="w-10 h-10 mb-2" />
                  <div className="text-2xl font-bold">50+</div>
                  <div className="text-blue-100">Cities</div>
                </div>
              </div>
            </div>
            <div className="relative">
              <img
                src="https://images.pexels.com/photos/2102416/pexels-photo-2102416.jpeg?auto=compress&cs=tinysrgb&w=800"
                alt="Modern parking facility"
                className="rounded-2xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-gray-900 text-white py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <ParkingCircle className="w-8 h-8 text-blue-400" />
                <span className="text-xl font-bold">ParkSmart</span>
              </div>
              <p className="text-gray-400 leading-relaxed">
                Experience the future of parking with ParkSmart. Simple, smart, and always available.
              </p>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => scrollToSection('home')}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    Home
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => scrollToSection('services')}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    Services
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => scrollToSection('about')}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    About Us
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => scrollToSection('pricing')}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    Pricing
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li className="hover:text-white transition-colors cursor-pointer">Help Center</li>
                <li className="hover:text-white transition-colors cursor-pointer">Terms of Service</li>
                <li className="hover:text-white transition-colors cursor-pointer">Privacy Policy</li>
                <li className="hover:text-white transition-colors cursor-pointer">FAQs</li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Contact Us</h4>
              <ul className="space-y-2 text-gray-400">
                <li>support@parksmart.com</li>
                <li>+1 (555) 123-4567</li>
                <li>123 Parking Plaza</li>
                <li>San Francisco, CA 94102</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-gray-400 text-sm">
                2025 ParkSmart. All rights reserved.
              </p>
              <div className="flex space-x-6 mt-4 md:mt-0">
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  Facebook
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  Twitter
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  Instagram
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  LinkedIn
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;