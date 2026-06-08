'use client';

interface PrivacyPolicyContentProps {
  onNavigate?: (path: string) => void;
  onClose?: () => void;
}

export default function PrivacyPolicyContent({ onNavigate, onClose }: PrivacyPolicyContentProps) {
  const handleInternalLink = (path: string) => {
    onClose?.();
    onNavigate?.(path);
  };

  return (
    <div className="space-y-6 text-gray-800">
      <section className="rounded-lg p-4 sm:p-6 bg-gray-50/50">
        <p className="text-gray-600 leading-relaxed">
          Inspire London College Limited is the data controller and we are responsible for your personal data (referred to as &quot;we&quot;, &quot;us&quot; or &quot;our&quot; in this privacy notice).
        </p>
        <p className="text-gray-600 leading-relaxed mt-3">
          We have appointed a Data Protection Officer who is in charge of privacy related matters for us. If you have any questions about this privacy notice, please contact the Data Protection Officer using the details set out below.
        </p>
        <p className="text-gray-600 leading-relaxed mt-3">
          It is very important that the information we hold about you is accurate and up to date. Please let us know if at any time your personal information changes by emailing us at info@inspirelondoncollege.co.uk OR by filling out our Contact Us form.
        </p>
      </section>

      <section className="rounded-lg p-4 sm:p-6 bg-gray-50/50">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Contact Details</h2>
        <p className="text-gray-600 mb-2">Our full details are:</p>
        <ul className="list-none space-y-1 text-gray-600">
          <li><strong className="text-gray-800">Full name of legal entity:</strong> Inspire London College Limited</li>
          <li><strong className="text-gray-800">Email address:</strong> dpo@inspirelondoncollege.co.uk</li>
          <li><strong className="text-gray-800">Postal address:</strong> Data Protection Officer, Inspire London College, First Floor, Fairlawn High Street UB1 3HB United Kingdom</li>
        </ul>
      </section>

      <section className="rounded-lg p-4 sm:p-6 bg-gray-50/50">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">What Data Do We Collect About You, For What Purpose And On What Ground We Process It</h2>
        <p className="text-gray-600 leading-relaxed">
          Personal data means any information capable of identifying an individual. It does not include anonymised data.
        </p>
        <p className="text-gray-600 leading-relaxed mt-3 mb-2">We may process the following categories of personal data about you:</p>
        <ul className="space-y-3 text-gray-600">
          <li><strong className="text-[#E51791]">Communication Data</strong> that includes any communication that you send to us whether that be through the contact form on our website, through email, text, social media messaging, social media posting or any other communication that you send us. We process this data for the purposes of communicating with you, for record keeping and for the establishment, pursuance or defence of legal claims. Our lawful ground for this processing is our legitimate interests which in this case are to reply to communications sent to us, to keep records and to establish, pursue or defend legal claims.</li>
          <li><strong className="text-[#E51791]">Customer Data</strong> that includes data relating to any purchases of goods and/or services such as your name, title, billing address, delivery address email address, phone number, contact details, purchase details and your card details. We process this data to supply the goods and/or services you have purchased and to keep records of such transactions. Our lawful ground for this processing is the performance of a contract between you and us and/or taking steps at your request to enter into such a contract.</li>
          <li><strong className="text-[#E51791]">User Data</strong> that includes data about how you use our website and any online services together with any data that you post for publication on our website or through other online services. We process this data to operate our website and ensure relevant content is provided to you, to ensure the security of our website, to maintain back-ups of our website and/or databases and to enable publication and administration of our website, other online services and business. Our lawful ground for this processing is our legitimate interests which in this case are to enable us to properly administer our website and our business.</li>
          <li><strong className="text-[#E51791]">Technical Data</strong> that includes data about your use of our website and online services such as your IP address, your login data, details about your browser, length of visit to pages on our website, page views and navigation paths, details about the number of times you use our website, time zone settings and other technology on the devices you use to access our website. The source of this data is from our analytics tracking system. We process this data to analyse your use of our website and other online services, to administer and protect our business and website, to deliver relevant website content and advertisements to you and to understand the effectiveness of our advertising. Our lawful ground for this processing is our legitimate interests which in this case are to enable us to properly administer our website and our business and to grow our business and to decide our marketing strategy.</li>
          <li><strong className="text-[#E51791]">Marketing Data</strong> that includes data about your preferences in receiving marketing from us and our third parties and your communication preferences. We process this data to enable you to partake in our promotions such as competitions, prize draws and free give-aways, to deliver relevant website content and advertisements to you and measure or understand the effectiveness of this advertising. Our lawful ground for this processing is our legitimate interests which in this case are to study how customers use our products/services, to develop them, to grow our business and to decide our marketing strategy.</li>
        </ul>
        <p className="text-gray-600 leading-relaxed mt-3">
          We may use Customer Data, User Data, Technical Data and Marketing Data to deliver relevant website content and advertisements to you (including Facebook adverts or other display advertisements) and to measure or understand the effectiveness of the advertising we serve you. Our lawful ground for this processing is legitimate interests which is to grow our business. We may also use such data to send other marketing communications to you. Our lawful ground for this processing is either consent or legitimate interests (namely to grow our business).
        </p>
        <p className="text-gray-600 leading-relaxed mt-3">
          Where we are required to collect personal data by law, or under the terms of the contract between us and you do not provide us with that data when requested, we may not be able to perform the contract (for example, to deliver goods or services to you). If you don&apos;t provide us with the requested data, we may have to cancel a product or service you have ordered but if we do, we will notify you at the time.
        </p>
        <p className="text-gray-600 leading-relaxed mt-3">
          We will only use your personal data for a purpose it was collected for or a reasonably compatible purpose if necessary. For more information on this please email us at info@inspirelondoncollege.co.uk. In case we need to use your details for an unrelated new purpose we will let you know and explain the legal grounds for processing.
        </p>
        <p className="text-gray-600 leading-relaxed mt-3">
          We may process your personal data without your knowledge or consent where this is required or permitted by law.
        </p>
      </section>

      <section className="rounded-lg p-4 sm:p-6 bg-gray-50/50">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">How We Collect Your Personal Data</h2>
        <p className="text-gray-600 leading-relaxed">
          We may collect data about you by you providing the data directly to us (for example by filling in forms on our site or by sending us emails). We may automatically collect certain data from you as you use our website by using cookies and similar technologies. Please see our{' '}
          {onNavigate && onClose ? (
            <button type="button" onClick={() => handleInternalLink('/cookie-policy')} className="text-[#11CCEF] hover:text-[#E51791] underline transition-colors font-medium">
              Cookie Policy
            </button>
          ) : (
            <span className="text-[#11CCEF] font-medium">Cookie Policy</span>
          )}
          {' '}for more details about this.
        </p>
        <p className="text-gray-600 leading-relaxed mt-3">
          We may receive data from third parties such as analytics providers such as Google based outside the EU, advertising networks such as Facebook based outside the EU, such as search information providers such as Google based outside the EU, providers of technical, payment and delivery services, such as data brokers or aggregators.
        </p>
        <p className="text-gray-600 leading-relaxed mt-3">
          We may also receive data from publicly availably sources such as Companies House and the Electoral Register based inside the EU.
        </p>
      </section>

      <section className="rounded-lg p-4 sm:p-6 bg-gray-50/50">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Website / VLE / Learning Platform Visitor Tracking</h2>
        <p className="text-gray-600 leading-relaxed">
          This website uses tracking software to monitor its visitors to better understand how they use it. The software will save a cookie to your computers hard drive in order to track and monitor your engagement and usage of the website, but will not store, save or collect personal information.
        </p>
      </section>

      <section className="rounded-lg p-4 sm:p-6 bg-gray-50/50">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Social Media Policy & Usage</h2>
        <p className="text-gray-600 leading-relaxed">
          We adopt a Social Media Policy to ensure our business, and our staff conduct themselves accordingly online. While we may have official profiles on social media platforms users are advised to verify the authenticity of such profiles before engaging with, or sharing information with such profiles. We will never ask for user passwords or personal details on social media platforms. Users are advised to conduct themselves appropriately when engaging with us on social media.
        </p>
        <p className="text-gray-600 leading-relaxed mt-3">
          There may be instances where our website features social sharing buttons, which help share web content directly from web pages to the respective social media platforms. You use social sharing buttons at your own discretion and accept that doing so may publish content to your social media profile feed or page.
        </p>
      </section>

      <section className="rounded-lg p-4 sm:p-6 bg-gray-50/50">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Contact & Communication With Us</h2>
        <p className="text-gray-600 leading-relaxed">
          Users contacting this us through this website do so at their own discretion and provide any such personal details requested at their own risk. Your personal information is kept private and stored securely until a time it is no longer required or has no use.
        </p>
        <p className="text-gray-600 leading-relaxed mt-3">
          Where we have clearly stated and made you aware of the fact, and where you have given your express permission, we may use your details to send you products/services information through a mailing list system. This is done in accordance with the regulations named in &apos;The policy&apos; above.
        </p>
      </section>

      <section className="rounded-lg p-4 sm:p-6 bg-gray-50/50">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Marketing Communications</h2>
        <p className="text-gray-600 leading-relaxed">
          Our lawful ground of processing your personal data to send you marketing communications is either your consent or our legitimate interests (namely to grow our business).
        </p>
        <p className="text-gray-600 leading-relaxed mt-3">
          Under the Privacy and Electronic Communications Regulations, we may send you marketing communications from us if (i) you made a purchase or asked for information from us about our goods or services or (ii) you agreed to receive marketing communications and in each case you have not opted out of receiving such communications since. Under these regulations, if you are a limited company, we may send you marketing emails without your consent. However you can still opt out of receiving marketing emails from us at any time.
        </p>
        <p className="text-gray-600 leading-relaxed mt-3">
          Before we share your personal data with any third party for their own marketing purposes we will get your express consent.
        </p>
        <p className="text-gray-600 leading-relaxed mt-3">
          You can ask us or third parties to stop sending you marketing messages at any time by emailing us at info@inspirelondoncollege.co.uk at any time.
        </p>
        <p className="text-gray-600 leading-relaxed mt-3">
          If you opt out of receiving marketing communications this opt-out does not apply to personal data provided as a result of other transactions, such as purchases, warranty registrations etc.
        </p>
      </section>

      <section className="rounded-lg p-4 sm:p-6 bg-gray-50/50">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Disclosures of Your Personal Data</h2>
        <p className="text-gray-600 mb-2">We may have to share your personal data with the parties set out below:</p>
        <ul className="list-disc list-inside space-y-1 text-gray-600">
          <li>Other companies in our group who provide services to us. Ie. Awarding bodies</li>
          <li>Service providers who provide IT and system administration services.</li>
          <li>Professional advisers including lawyers, auditors and insurers</li>
          <li>Government bodies that require us to report processing activities.</li>
          <li>Third parties to whom we sell, transfer, or merge parts of our business or our assets.</li>
        </ul>
        <p className="text-gray-600 leading-relaxed mt-3">
          We require all third parties to whom we transfer your data to respect the security of your personal data and to treat it in accordance with the law. We only allow such third parties to process your personal data for specified purposes and in accordance with our instructions.
        </p>
      </section>

      <section className="rounded-lg p-4 sm:p-6 bg-gray-50/50">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">International Transfers</h2>
        <p className="text-gray-600 leading-relaxed">
          We share your personal data within our group of companies which involves transferring your data outside the European Economic Area (EEA).
        </p>
        <p className="text-gray-600 leading-relaxed mt-3">
          Countries outside of the European Economic Area (EEA) do not always offer the same levels of protection to your personal data, so European law has prohibited transfers of personal data outside of the EEA unless the transfer meets certain criteria.
        </p>
        <p className="text-gray-600 leading-relaxed mt-3">
          Many of our third parties service providers are based outside the European Economic Area (EEA) so their processing of your personal data will involve a transfer of data outside the EEA.
        </p>
        <p className="text-gray-600 leading-relaxed mt-3 mb-2">
          Whenever we transfer your personal data out of the EEA, we do our best to ensure a similar degree of security of data by ensuring at least one of the following safeguards is in place:
        </p>
        <ul className="list-disc list-inside space-y-1 text-gray-600">
          <li>We will only transfer your personal data to countries that the European Commission have approved as providing an adequate level of protection for personal data by; or</li>
          <li>Where we use certain service providers, we may use specific contracts or codes of conduct or certification mechanisms approved by the European Commission which give personal data the same protection it has in Europe; or</li>
          <li>If we use US-based providers that are part of EU-US Privacy Shield, we may transfer data to them, as they have equivalent safeguards in place.</li>
        </ul>
        <p className="text-gray-600 leading-relaxed mt-3">
          If none of the above safeguards is available, we may request your explicit consent to the specific transfer. You will have the right to withdraw this consent at any time.
        </p>
      </section>

      <section className="rounded-lg p-4 sm:p-6 bg-gray-50/50">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Data Security</h2>
        <p className="text-gray-600 leading-relaxed">
          We have put in place security measures to prevent your personal data from being accidentally lost, used, altered, disclosed, or accessed without authorisation. We also allow access to your personal data only to those employees and partners who have a business need to know such data. They will only process your personal data on our instructions and they must keep it confidential.
        </p>
        <p className="text-gray-600 leading-relaxed mt-3">
          We have procedures in place to deal with any suspected personal data breach and will notify you and any applicable regulator of a breach if we are legally required to.
        </p>
      </section>

      <section className="rounded-lg p-4 sm:p-6 bg-gray-50/50">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Data Retention</h2>
        <p className="text-gray-600 leading-relaxed">
          We will only retain your personal data for as long as necessary to fulfil the purposes we collected it for, including for the purposes of satisfying any legal, accounting, or reporting requirements.
        </p>
        <p className="text-gray-600 leading-relaxed mt-3">
          When deciding what the correct time is to keep the data for we look at its amount, nature and sensitivity, potential risk of harm from unauthorised use or disclosure, the processing purposes, if these can be achieved by other means and legal requirements.
        </p>
        <p className="text-gray-600 leading-relaxed mt-3">
          For tax purposes the law requires us to keep basic information about our customers (including Contact, Identity, Financial and Transaction Data) for six years after they stop being customers.
        </p>
        <p className="text-gray-600 leading-relaxed mt-3">
          In some circumstances we may anonymise your personal data for research or statistical purposes in which case we may use this information indefinitely without further notice to you.
        </p>
      </section>

      <section className="rounded-lg p-4 sm:p-6 bg-gray-50/50">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Your Legal Rights</h2>
        <p className="text-gray-600 leading-relaxed">
          Under data protection laws you have rights in relation to your personal data that include the right to request access, correction, erasure, restriction, transfer, to object to processing, to portability of data and (where the lawful ground of processing is consent) to withdraw consent.
        </p>
        <p className="text-gray-600 leading-relaxed mt-3">
          You can see more about these rights at the Information Commissioner&apos;s Office (ICO) website.
        </p>
        <p className="text-gray-600 leading-relaxed mt-3">
          If you wish to exercise any of the rights set out above, please email us at dpo@inspirelondoncollege.co.uk.
        </p>
        <p className="text-gray-600 leading-relaxed mt-3">
          You will not have to pay a fee to access your personal data (or to exercise any of the other rights). However, we may charge a reasonable fee if your request is clearly unfounded, repetitive or excessive or refuse to comply with your request in these circumstances.
        </p>
        <p className="text-gray-600 leading-relaxed mt-3">
          We may need to request specific information from you to help us confirm your identity and ensure your right to access your personal data (or to exercise any of your other rights). This is a security measure to ensure that personal data is not disclosed to any person who has no right to receive it. We may also contact you to ask you for further information in relation to your request to speed up our response.
        </p>
        <p className="text-gray-600 leading-relaxed mt-3">
          We try to respond to all legitimate requests within one month. Occasionally it may take us longer than a month if your request is particularly complex or you have made a number of requests. In this case, we will notify you.
        </p>
        <p className="text-gray-600 leading-relaxed mt-3">
          If you are not happy with any aspect of how we collect and use your data, you have the right to complain to the Information Commissioner&apos;s Office (ICO), the UK supervisory authority for data protection issues. We should be grateful if you would contact us first if you do have a complaint so that we can try to resolve it for you.
        </p>
      </section>

      <section className="rounded-lg p-4 sm:p-6 bg-gray-50/50">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Third-Party Links</h2>
        <p className="text-gray-600 leading-relaxed">
          This website may include links to third-party websites, plug-ins and applications. Clicking on those links or enabling those connections may allow third parties to collect or share data about you. We do not control these third-party websites and are not responsible for their privacy statements. When you leave our website, we encourage you to read the privacy notice of every website you visit.
        </p>
      </section>

      <section className="rounded-lg p-4 sm:p-6 bg-gray-50/50">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Cookies</h2>
        <p className="text-gray-600 leading-relaxed">
          You can set your browser to refuse all or some browser cookies or to alert you when websites set or access cookies. If you disable or refuse cookies, please note that some parts of this website may become inaccessible or not function properly. For more information about the cookies we use, please see our{' '}
          {onNavigate && onClose ? (
            <button type="button" onClick={() => handleInternalLink('/cookie-policy')} className="text-[#11CCEF] hover:text-[#E51791] underline transition-colors font-medium">
              Cookie Policy
            </button>
          ) : (
            <span className="text-[#11CCEF] font-medium">Cookie Policy</span>
          )}.
        </p>
      </section>

      <section className="rounded-lg p-4 sm:p-6 bg-gray-100 border border-gray-200">
        <p className="text-gray-600 text-sm">
          Copyright in this Privacy Policy belongs to Suzanne Dibble. This privacy policy prepared (Edited & customized) from the modules provided by Suzanne Dibble&apos;s Small Business Legal Academy by Inspire London College.
        </p>
        <p className="text-gray-600 text-sm italic mt-3">
          Note: Changes in the policies will be posted on our Website. You are advised to check our college website regularly to view our most recent policies.
        </p>
      </section>
    </div>
  );
}
