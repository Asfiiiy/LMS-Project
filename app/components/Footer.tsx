'use client';

import Link from "next/link";
import { FaFacebook, FaPhone, FaEnvelope, FaInstagram, FaYoutube, FaLinkedin, FaPinterest } from "react-icons/fa";
import { useState } from "react";

function Footer() {
  const [imageError, setImageError] = useState(false);

  return (
    <footer className="bg-gray-900 text-white w-full overflow-x-hidden">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 md:py-12 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10">
          {/* Column 1: Logo & About Us */}
          <div className="space-y-3 sm:space-y-4">
            {/* Logo Image */}
            <div className="mb-4">
              {!imageError ? (
                <img
                  src="/assets/poi.webp"
                  alt="Inspire London College Logo"
                  className="object-contain max-w-full h-auto max-h-20"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                    <div className="relative">
                      <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 border-2 border-gray-900 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 bg-gray-900 rounded-full"></div>
                      </div>
                      <div className="absolute -bottom-0.5 sm:-bottom-1 left-1/2 transform -translate-x-1/2 w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 border-2 border-gray-900 border-t-0 rounded-b-full"></div>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-base sm:text-lg md:text-xl font-bold leading-tight">Inspire</span>
                    <span className="text-base sm:text-lg md:text-xl font-bold leading-tight">London</span>
                    <span className="text-base sm:text-lg md:text-xl font-bold leading-tight">College</span>
                  </div>
                </div>
              )}
            </div>
            <p className="text-gray-300 text-xs sm:text-sm leading-relaxed">
              Inspire London College is a leading provider of online courses, professional qualifications, and practical training in the UK. We deliver flexible, high-quality education that equips you with the skills and knowledge needed to excel in today's competitive job market.
            </p>
          </div>

          {/* Column 2: Contact Us - Middle */}
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-lg sm:text-xl font-bold text-[#E51791] mb-3 sm:mb-4">Contact Us</h3>
            <div className="space-y-3 sm:space-y-4 text-gray-300 text-xs sm:text-sm">
              <p className="leading-relaxed">
                First Floor, Fairlawn High Street<br />
                Southall London UB1 3HB<br />
                United Kingdom
              </p>
              
              <div className="flex items-center gap-2 flex-wrap">
                <FaPhone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white flex-shrink-0" />
                <span className="break-words">Phone : +44 (0) 20 7101 9543</span>
              </div>
            </div>
          </div>

          {/* Column 3: Follow Us - Right */}
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-lg sm:text-xl font-bold text-[#E51791] mb-3 sm:mb-4">Follow Us</h3>
            <div className="flex gap-2 sm:gap-3 flex-wrap">
              {/* YouTube */}
              <a
                href="https://www.youtube.com/channel/UCDBmELV1g8Tt2b8xI57oPIA"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube"
                className="w-10 h-10 sm:w-12 sm:h-12 bg-red-600 rounded flex items-center justify-center text-white hover:bg-red-700 active:bg-red-800 transition-colors touch-manipulation"
              >
                <FaYoutube className="w-5 h-5 sm:w-6 sm:h-6" />
              </a>
              {/* Instagram */}
              <a
                href="https://www.instagram.com/inspire.london.college/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 rounded flex items-center justify-center text-white hover:opacity-90 active:opacity-80 transition-opacity touch-manipulation"
              >
                <FaInstagram className="w-5 h-5 sm:w-6 sm:h-6" />
              </a>
              {/* Facebook */}
              <a
                href="https://www.facebook.com/inspirelondoncollege.uk/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 rounded flex items-center justify-center text-white hover:bg-blue-700 active:bg-blue-800 transition-colors touch-manipulation"
              >
                <FaFacebook className="w-5 h-5 sm:w-6 sm:h-6" />
              </a>
              {/* LinkedIn */}
              <a
                href="https://www.linkedin.com/company/inspire-london-college/?trk=organization-update_share-update_actor-text"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-700 rounded flex items-center justify-center text-white hover:bg-blue-800 active:bg-blue-900 transition-colors touch-manipulation"
              >
                <FaLinkedin className="w-5 h-5 sm:w-6 sm:h-6" />
              </a>
              {/* Pinterest */}
              <a
                href="https://uk.pinterest.com/inspirelondoncollege/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Pinterest"
                className="w-10 h-10 sm:w-12 sm:h-12 bg-red-600 rounded flex items-center justify-center text-white hover:bg-red-700 active:bg-red-800 transition-colors touch-manipulation"
              >
                <FaPinterest className="w-5 h-5 sm:w-6 sm:h-6" />
              </a>
            </div>

            {/* 3 Columns for Email Categories - Below Follow Us */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-3 pt-4 border-t border-gray-700">
              {/* Column 1: Tutor Support */}
              <div>
                <h4 className="font-semibold text-white mb-2 text-xs sm:text-sm">Tutor Support</h4>
                <div className="space-y-1.5">
                  <div className="flex items-start gap-1.5">
                    <FaEnvelope className="w-3 h-3 text-white flex-shrink-0 mt-0.5" />
                    <Link 
                      href="mailto:study@inspirelondoncollege.co.uk" 
                      className="underline hover:text-white transition-colors break-all text-xs"
                    >
                      study@inspirelondoncollege.co.uk
                    </Link>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <FaEnvelope className="w-3 h-3 text-white flex-shrink-0 mt-0.5" />
                    <Link 
                      href="mailto:onlinetutor@inspirelondoncollege.co.uk" 
                      className="underline hover:text-white transition-colors break-all text-xs"
                    >
                      onlinetutor@inspirelondoncollege.co.uk
                    </Link>
                  </div>
                </div>
              </div>

              {/* Column 2: General & Admission */}
              <div>
                <h4 className="font-semibold text-white mb-2 text-xs sm:text-sm">General & Admission</h4>
                <div className="space-y-1.5">
                  <div className="flex items-start gap-1.5">
                    <FaEnvelope className="w-3 h-3 text-white flex-shrink-0 mt-0.5" />
                    <Link 
                      href="mailto:info@inspirelondoncollege.co.uk" 
                      className="underline hover:text-white transition-colors break-all text-xs"
                    >
                      info@inspirelondoncollege.co.uk
                    </Link>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <FaEnvelope className="w-3 h-3 text-white flex-shrink-0 mt-0.5" />
                    <Link 
                      href="mailto:admissions@inspirelondoncollege.co.uk" 
                      className="underline hover:text-white transition-colors break-all text-xs"
                    >
                      admissions@inspirelondoncollege.co.uk
                    </Link>
                  </div>
                </div>
              </div>

              {/* Column 3: Complaints */}
              <div>
                <h4 className="font-semibold text-white mb-2 text-xs sm:text-sm">Complaints & Quality</h4>
                <div className="flex items-start gap-1.5">
                  <FaEnvelope className="w-3 h-3 text-white flex-shrink-0 mt-0.5" />
                  <Link 
                    href="mailto:complaints@inspirelondoncollege.co.uk" 
                    className="underline hover:text-white transition-colors break-all text-xs"
                  >
                    complaints@inspirelondoncollege.co.uk
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-gray-700 mt-6 sm:mt-8 pt-4 sm:pt-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4 px-2">
            {/* Left: Copyright with Version */}
            <p className="text-gray-400 text-xs sm:text-sm text-center sm:text-left leading-relaxed">
              Copyright © 2025{' '}
              <a
                href="https://inspirelondoncollege.co.uk/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 transition-colors underline"
              >
                Inspire London College
              </a>
              . All rights reserved.{' '}
              <span className="font-semibold text-white">Version 1.0.0</span>
            </p>
            
            {/* Right: Developer Credit */}
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-xs sm:text-sm">Developer:</span>
              <a
                href="https://www.linkedin.com/in/asfand-yar-b937a9231/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors text-xs sm:text-sm font-medium group"
              >
                <FaLinkedin className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span className="underline">Asfand</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;