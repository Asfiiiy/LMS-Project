'use client';

import Link from "next/link";
import { FaFacebook, FaPhone, FaEnvelope, FaInstagram, FaYoutube, FaLinkedin, FaPinterest } from "react-icons/fa";
import { useState } from "react";

const EMAIL_SECTIONS = [
  {
    title: "Tutor Support",
    emails: [
      { label: "Study", href: "mailto:study@inspirelondoncollege.co.uk" },
      { label: "Online Tutor", href: "mailto:onlinetutor@inspirelondoncollege.co.uk" },
    ],
  },
  {
    title: "General & Admission",
    emails: [
      { label: "Info", href: "mailto:info@inspirelondoncollege.co.uk" },
      { label: "Admissions", href: "mailto:admissions@inspirelondoncollege.co.uk" },
    ],
  },
  {
    title: "Complaints & Quality",
    emails: [
      { label: "Complaints", href: "mailto:complaints@inspirelondoncollege.co.uk" },
    ],
  },
] as const;

function Footer() {
  const [imageError, setImageError] = useState(false);

  return (
    <footer className="bg-gray-900 text-white w-full overflow-x-hidden">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 md:py-6 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
          {/* Column 1: Logo & About Us */}
          <div className="space-y-2 sm:space-y-3">
            {/* Logo Image */}
            <div className="mb-2">
              {!imageError ? (
                <img
                  src="/assets/poi.webp"
                  alt="Inspire London College Logo"
                  className="object-contain max-w-full h-auto max-h-14"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-white rounded-full flex items-center justify-center flex-shrink-0">
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
            <p className="text-gray-300 text-xs sm:text-sm leading-snug">
              Inspire London College is a leading provider of online courses, professional qualifications, and practical training in the UK. We deliver flexible, high-quality education that equips you with the skills and knowledge needed to excel in today's competitive job market.
            </p>
          </div>

          {/* Column 2: Contact Us, then Follow Us */}
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-base sm:text-lg font-bold text-[#E51791] mb-2 sm:mb-3">Contact Us</h3>
            <div className="space-y-2 sm:space-y-3 text-gray-300 text-xs sm:text-sm">
              <p className="leading-snug">
                First Floor, Fairlawn High Street<br />
                Southall London UB1 3HB<br />
                United Kingdom
              </p>
              
              <div className="flex items-center gap-2 flex-wrap">
                <FaPhone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white flex-shrink-0" />
                <span className="break-words">Phone : +44 (0) 20 7101 9543</span>
              </div>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-[#E51791] mb-2 sm:mb-3 pt-2 border-t border-gray-700">Follow Us</h3>
            <div className="flex gap-2 sm:gap-3 flex-wrap">
              {/* YouTube */}
              <a
                href="https://www.youtube.com/channel/UCDBmELV1g8Tt2b8xI57oPIA"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube"
                className="w-8 h-8 sm:w-9 sm:h-9 bg-red-600 rounded flex items-center justify-center text-white hover:bg-red-700 active:bg-red-800 transition-colors touch-manipulation"
              >
                <FaYoutube className="w-4 h-4 sm:w-5 sm:h-5" />
              </a>
              {/* Instagram */}
              <a
                href="https://www.instagram.com/inspire.london.college/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 rounded flex items-center justify-center text-white hover:opacity-90 active:opacity-80 transition-opacity touch-manipulation"
              >
                <FaInstagram className="w-4 h-4 sm:w-5 sm:h-5" />
              </a>
              {/* Facebook */}
              <a
                href="https://www.facebook.com/inspirelondoncollege.uk/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="w-8 h-8 sm:w-9 sm:h-9 bg-blue-600 rounded flex items-center justify-center text-white hover:bg-blue-700 active:bg-blue-800 transition-colors touch-manipulation"
              >
                <FaFacebook className="w-4 h-4 sm:w-5 sm:h-5" />
              </a>
              {/* LinkedIn */}
              <a
                href="https://www.linkedin.com/company/inspire-london-college/?trk=organization-update_share-update_actor-text"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="w-8 h-8 sm:w-9 sm:h-9 bg-blue-700 rounded flex items-center justify-center text-white hover:bg-blue-800 active:bg-blue-900 transition-colors touch-manipulation"
              >
                <FaLinkedin className="w-4 h-4 sm:w-5 sm:h-5" />
              </a>
              {/* Pinterest */}
              <a
                href="https://uk.pinterest.com/inspirelondoncollege/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Pinterest"
                className="w-8 h-8 sm:w-9 sm:h-9 bg-red-600 rounded flex items-center justify-center text-white hover:bg-red-700 active:bg-red-800 transition-colors touch-manipulation"
              >
                <FaPinterest className="w-4 h-4 sm:w-5 sm:h-5" />
              </a>
            </div>
          </div>

          {/* Column 3: Contact Emails */}
          <div className="space-y-3">
            <h4 className="font-semibold text-white mb-2 text-sm">Contact Emails</h4>
            {EMAIL_SECTIONS.map((section) => (
              <div key={section.title} className="space-y-1.5">
                <p className="text-gray-400 text-xs font-medium">{section.title}</p>
                {section.emails.map((email) => {
                  const addr = email.href.replace("mailto:", "");
                  return (
                    <a
                      key={addr}
                      href={email.href}
                      className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors text-xs sm:text-sm group"
                    >
                      <FaEnvelope className="w-3 h-3 text-white flex-shrink-0" />
                      <span className="whitespace-nowrap underline group-hover:no-underline">{addr}</span>
                    </a>
                  );
                })}
              </div>
            ))}
          </div>
          </div>

        {/* Legal Links */}
        <div className="border-t border-gray-700 mt-4 sm:mt-5 pt-3 sm:pt-4">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mb-2">
            <a
              href="https://inspirelondoncollege.co.uk/privacy-policy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white text-xs sm:text-sm transition-colors underline"
            >
              Privacy Policy
            </a>
            <a
              href="https://inspirelondoncollege.co.uk/terms-conditions/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white text-xs sm:text-sm transition-colors underline"
            >
              Terms & Conditions
            </a>
            <Link href="/cookie-policy" className="text-gray-400 hover:text-white text-xs sm:text-sm transition-colors underline">
              Cookie Policy
            </Link>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-gray-700 pt-3 sm:pt-4">
          <p className="text-gray-400 text-xs sm:text-sm text-center sm:text-left leading-relaxed px-2">
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
        </div>
      </div>
    </footer>
  );
};

export default Footer;