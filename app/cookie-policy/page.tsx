import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Cookie Policy | Inspire LMS',
  description: 'Information about cookies used on the Inspire London College website.',
};

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <Link href="/" className="inline-flex items-center gap-2 text-[#11CCEF] hover:text-[#E51791] text-sm font-medium mb-6 transition-colors">
          <span>←</span> Back to Home
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Cookie Policy</h1>
        <p className="text-gray-500 text-sm mb-8">Last updated: February 2025</p>

        <div className="space-y-6">
          <section className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">What&apos;s a Cookie?</h2>
            <p className="text-gray-600 leading-relaxed">
              A &quot;cookie&quot; is a piece of information that is stored on your computer&apos;s hard drive and which records how you move your way around a website so that, when you revisit that website, it can present tailored options based on the information stored about your last visit. Cookies can also be used to analyse traffic and for advertising and marketing purposes.
            </p>
            <p className="text-gray-600 leading-relaxed mt-3">
              Cookies are used by nearly all websites and do not harm your system.
            </p>
            <p className="text-gray-600 leading-relaxed mt-3">
              If you want to check or change what types of cookies you accept, this can usually be altered within your browser settings. You can block cookies at any time by activating the setting on your browser that allows you to refuse the setting of all or some cookies. However, if you use your browser settings to block all cookies (including essential cookies) you may not be able to access all or parts of our site.
            </p>
          </section>

          <section className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">How Do We Use Cookies?</h2>
            <p className="text-gray-600 leading-relaxed">
              We use cookies to track your use of our website. This enables us to understand how you use the site and track any patterns with regards how you are using our website. This helps us to develop and improve our website as well as products and/or services in response to what you might need or want.
            </p>
          </section>

          <section className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Our Website & Learning Platform (VLE) Cookies</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-[#E51791] font-semibold border-b border-gray-200">Cookie</th>
                    <th className="px-4 py-3 text-left text-[#E51791] font-semibold border-b border-gray-200">Title</th>
                    <th className="px-4 py-3 text-left text-[#E51791] font-semibold border-b border-gray-200">Description</th>
                  </tr>
                </thead>
                <tbody className="text-gray-600">
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-3 font-mono">wc_cart_hash_#</td>
                    <td className="px-4 py-3">—</td>
                    <td className="px-4 py-3">These cookies are used to store information, such as your name, phone and email address what time your current visit occurred, for filling automatically forms.</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-3 font-mono">wc_fragments_#</td>
                    <td className="px-4 py-3">—</td>
                    <td className="px-4 py-3">These cookies contain your computer&apos;s IP address to know from where in the world you are accessing the Internet.</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-3 font-mono">Session</td>
                    <td className="px-4 py-3">Learning Platform</td>
                    <td className="px-4 py-3">The essential one is the session cookie. You must allow this cookie into your browser to provide continuity and maintain your login from page to page. When you log out or close the browser this cookie is destroyed (in your browser and on the server).</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono">LEARNING PLATFORM ID</td>
                    <td className="px-4 py-3">Learning Platform VLE</td>
                    <td className="px-4 py-3">The other cookie is purely for convenience. It just remembers your username within the browser. This means when you return to this site the username field on the login page will be already filled out for you. It is safe to refuse this cookie – you will just have to retype your username every time you log in.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Types of Cookies</h2>
            <p className="text-gray-600 mb-3">Cookies are either:</p>
            <ul className="space-y-2 text-gray-600">
              <li><strong className="text-gray-800">Session cookies:</strong> these are only stored on your computer during your web session and are automatically deleted when you close your browser – they usually store an anonymous session ID allowing you to browse a website without having to log in to each page but they do not collect any personal data from your computer; or</li>
              <li><strong className="text-gray-800">Persistent cookies:</strong> a persistent cookie is stored as a file on your computer and it remains there when you close your web browser. The cookie can be read by the website that created it when you visit that website again. We use persistent cookies for Google Analytics.</li>
            </ul>
          </section>

          <section className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Google Analytics Cookies</h2>
            <p className="text-gray-600 mb-3">The cookies in use to deliver Google Analytics service are described in the table below.</p>
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-[#E51791] font-semibold border-b border-gray-200">Cookie</th>
                    <th className="px-4 py-3 text-left text-[#E51791] font-semibold border-b border-gray-200">Title</th>
                    <th className="px-4 py-3 text-left text-[#E51791] font-semibold border-b border-gray-200">Description</th>
                  </tr>
                </thead>
                <tbody className="text-gray-600">
                  <tr>
                    <td className="px-4 py-3 font-mono">__utma, __utmb, __utmc, __utmv, __utmz</td>
                    <td className="px-4 py-3">Google Analytics</td>
                    <td className="px-4 py-3">These cookies are used to store information, such as what time your current visit occurred, whether you have been to the site before, and what site referred you to the web page. These cookies contain no personally identifiable information but they will use your computer&apos;s IP address to know from where in the world you are accessing the Internet. Google stores the information collected by these cookies on servers in the United States. Google may transfer this information to third-parties where required to do so by law, or where such third-parties process the information on Google&apos;s behalf.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Cookie Categories</h2>
            <ul className="space-y-3 text-gray-600">
              <li>
                <strong className="text-[#11CCEF]">Strictly necessary cookies:</strong> These cookies are essential to enable you to use the website effectively, such as when buying a product and/or service, and therefore cannot be turned off. Without these cookies, the services available to you on our website cannot be provided. These cookies do not gather information about you that could be used for marketing or remembering where you have been on the internet.
                <ul className="mt-2 ml-4 space-y-1 text-sm">
                  <li>• <strong>PHPSESSION:</strong> Phpsessions is an essential cookie that assigns a session to each visit to ensure the site&apos;s functionality works properly, that only lasts while you are on this site. No information is retained or shared with anyone.</li>
                  <li>• <strong>regID:</strong> regID is an essential cookie which helps the website remember you after you have logged in, allowing you to utilise specific website functionality for logged in users only. No information is retained or shared with anyone.</li>
                </ul>
              </li>
              <li><strong className="text-[#11CCEF]">Performance cookies:</strong> These cookies enable us to monitor and improve the performance of our website. For example, they allow us to count visits, identify traffic sources and see which parts of the site are most popular.</li>
              <li><strong className="text-[#11CCEF]">Functionality cookies:</strong> These cookies allow our website to remember choices you make and provide enhanced features. For instance, we may be able to provide you with news or updates relevant to the services you use. They may also be used to provide services you have requested such as viewing a video or commenting on a blog. The information these cookies collect is usually anonymised.</li>
            </ul>
            <p className="text-gray-600 mt-3">
              We use cookies to differentiate you from other users of the website. This helps us to provide you with a good understanding when you use the browse the websites and also allows us to improve the service, the website.
            </p>
          </section>

          <section className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Third Party Cookies</h2>
            <p className="text-gray-600 leading-relaxed">
              These are cookies released via our website, but by other websites, e.g. if we host a video on YouTube.com and insert that on our site, when you click play YouTube drops a cookie on your machine so it knows you have watched it. Or if you hit the &apos;Like&apos; button on one of our pages the social media site will drop a cookie. Same like other social media tools and Learning Platform.
            </p>
            <p className="text-gray-600 leading-relaxed mt-3">
              We do try, wherever possible, to only allow third-party cookies to be dropped on your device from websites we trust.
            </p>
            <p className="text-gray-600 leading-relaxed mt-3">
              Please note that third parties who advertise on our website (including, for example, advertising networks and providers of external services like web traffic analysis services) may also use cookies, over which we have no control. These cookies are likely to be analytical/performance cookies or targeting cookies.
            </p>
          </section>

          <section className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Consent</h2>
            <p className="text-gray-600 leading-relaxed">
              By using our website <strong>lms.inspirelondoncollege.com</strong>, you are giving us consent to use of cookies.
            </p>
          </section>

          <section className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <p className="text-gray-600 text-sm italic">
              We are compliant with UK-GDPR. We will keep your details safe & you can ask anytime to remove.
            </p>
            <p className="text-gray-600 text-sm italic mt-2">
              Changes in the policies will be posted on our Website. You are advised to check our college website regularly to view our most recent policies.
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-200 flex flex-wrap gap-3">
          <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 bg-[#11CCEF] hover:bg-[#0db8d9] text-white font-medium rounded-lg transition-colors text-sm">
            ← Back to Home
          </Link>
          <Link href="/privacy-policy" className="inline-flex items-center px-4 py-2 border border-[#E51791] text-[#E51791] hover:bg-[#E51791] hover:text-white font-medium rounded-lg transition-colors text-sm">
            Privacy Policy
          </Link>
          <Link href="/terms-and-conditions" className="inline-flex items-center px-4 py-2 border border-[#11CCEF] text-[#11CCEF] hover:bg-[#11CCEF] hover:text-white font-medium rounded-lg transition-colors text-sm">
            Terms & Conditions
          </Link>
        </div>
      </div>
    </div>
  );
}
