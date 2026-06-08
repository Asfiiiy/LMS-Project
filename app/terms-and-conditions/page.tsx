import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms & Conditions | Inspire LMS',
  description: 'Terms of use and enrollment conditions for Inspire London College.',
};

export default function TermsAndConditionsPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <Link href="/" className="inline-flex items-center gap-2 text-[#11CCEF] hover:text-[#E51791] text-sm font-medium mb-6 transition-colors">
          <span>←</span> Back to Home
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Terms & Conditions</h1>
        <p className="text-gray-500 text-sm mb-8">Last updated: February 2025</p>

        {/* Introduction */}
        <div className="mb-8 p-6 bg-white rounded-lg shadow-sm border border-gray-100">
          <p className="text-gray-600 leading-relaxed mb-4">
            We have categorised the terms and conditions for different formats separately. Please choose the terms & conditions that apply to your CPD Courses or Qualifications. If you have any questions, please contact our friendly support team for assistance.
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-1 text-sm">
            <li><strong className="text-[#E51791]">CPD Courses</strong></li>
            <li><strong className="text-[#E51791]">Certification & Learning Platform / VLE Privacy Policy</strong></li>
            <li><strong className="text-[#E51791]">Regulated Qualifications</strong></li>
            <li><strong className="text-[#E51791]">Medical / Phlebotomy CPD Accredited Training</strong></li>
            <li><strong className="text-[#E51791]">Classed Based Qualifications</strong> (Security, First Aid, and Education & Training etc)</li>
          </ul>
          <p className="text-gray-500 text-sm mt-4 italic">
            Note: Changes in the terms and conditions will be posted on our Website. You are advised to check our college website regularly to view our most recent policies.
          </p>
        </div>

        <div className="space-y-4">
          {/* 1. CPD Courses */}
          <details className="group bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <summary className="flex items-center justify-between cursor-pointer list-none px-4 py-4 font-semibold text-gray-900 hover:bg-gray-50 transition-colors [&::-webkit-details-marker]:hidden border-l-4 border-[#E51791]">
              <span>1. Terms and Conditions (CPD Courses)</span>
              <span className="text-[#11CCEF] group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-4 pb-4 pt-0 space-y-4 text-gray-600 leading-relaxed border-t border-gray-100">
              <p>Terms and conditions are the foundation of a learning contract. Being part of Inspire London College as a learner this is a contract between &quot;learner or Learner(s)&quot; and &quot;Inspire London College (ILC)&quot;.</p>
              <p>Following terms and conditions are essential to fulfilling by the learners if they register with Inspire London College (ILC) direct (from our website lms.inspirelondoncollege.com or through 3rd party website(s)).</p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>The learner will receive the course registration & login details for an online portal (Learning Platform/VLE) from ILC within 48 hours of the course purchase. In the case, you have not received course registration & login details, contact ILC via email.</li>
                <li>Access to VLE/Learning Platform is given only after receiving the learner&apos;s tuition fee (in full, or first instalment).</li>
                <li>The learner can enrol in the multiple CPD courses at the same time, and he/she can complete them in parallel.</li>
                <li>Inspire London College will provide learning material via Learning Platform/VLE only.</li>
                <li>Course material includes all the essential learning material such as Course Units, Access to VLE/Learning Platform, Assessments, Quizzes (if require) in PDF, Microsoft Word, Excel, PowerPoint format and other useful study links.</li>
                <li>All the courses material will be in the form of texts (images/illustrations), and there will be no video or live lectures during the course.</li>
                <li>Learners can contact their online tutor through VLE/Learning Platform or via email regarding assistance in their studies throughout the course.</li>
                <li>The minimum time period to complete ILC courses is one week to sixteen weeks, and maximum period to complete the course is up to twelve months. Learners will have access to VLE/Learning Platform up to 12 months from the date of enrolment. During this period, flexibility will be given to learners for completing the course at any time.</li>
                <li>After the completion of the course and/or course maximum duration (12 months from the date of enrolment) the access to VLE/Learning Platform will be terminated without prior notice, and for further information/communication learners can contact via email.</li>
                <li>College may extend the period up to six months with extra charges (if the learner has shown his/her progress, i.e. submitted assignments/passed over 50% modules of the course). A learner can contact the college for further information. Please be informed that the Inspire London College reserves the right to grant extensions to the course duration.</li>
                <li>In case of course fee payment by Instalment option, learners will need to pay their regular instalments on time, and after three consecutive pending invoices, the learners will be suspended from the course.</li>
                <li>Inspire London College will apply for an CPD certificate upon receiving the certificate fee, and learners must clear their pending fees and certificate charges before that.</li>
                <li>If a learner wants to cancel or no longer wish to be on the course, then he/she will be eligible to apply for a full refund within 14 days cooling-off period according to Consumer Contract Regulations 2013. (This condition applies only if the learner has not logged in to the VLE/Learning Platform and accessed the course or have not communicated with the admissions team or online tutor via email or over the phone).</li>
                <li>CPD Course Fee, Exams Fee, Certificate Fee & registrations fee paid is not transferable to another learner, participant or representative where the learner does not like to continue the course or the employee has left the company or is unable to continue study due to any reason. If you are in a 14-day cooling-off period and the learner has not logged in to the portal and accessed the course material, a learner can request a refund.</li>
                <li>At the time of registration/course purchase via college website or third party website, a learner needs to provide his/her accurate, complete and current information all the time for VLE/Learning Platform account and registration. Failure to do so constitutes a breach of the terms and conditions, which may result in immediate termination/suspension of VLE/Learning Platform account and registration from the course without further notice.</li>
                <li>The learner is responsible for protecting the Learning Platform/VLE&apos;s Username & Password and for any activities or actions under your password.</li>
                <li>The learner is agreed not to disclose his/her password to any third party or any other learner. Breach of this condition may result in immediate termination/suspension of learner&apos;s VLE/Learning Platform account and registration from the course without further notice.</li>
                <li>Learner must notify the college immediately upon becoming aware of any breach of security or unauthorised use of VLE/Learning Platform account.</li>
                <li>Learner cannot use a username of another learner or entity that is not lawfully accessible for their use. Learner must explicitly agree that college cannot be held liable for any loss or damage arising out of any falsifications learner make in this regard.</li>
                <li>ILC accepts the payments through; Bank Transfer, Western Union, PayPal and Credit and Debit Card, therefore any other mode of transferring the payments will not be accepted and Inspire London College will not be responsible for that.</li>
                <li>Course fee (without discount) includes the accreditation fee and postal charges; therefore, learners are not required to pay extra charges (This condition does not apply to the course purchased from our website or any third-party website(s), where ILC may have advertised the courses on discounted price).</li>
                <li>Upon successfully passing the Course, Learner can claim the Certificate of Completion from Inspire London College (either in PDF format or Hardcopy) by paying the Certificate fee. (You can check the certificate fee on our website in the course description under Certificate TAB or by visiting the page Fees & Pricing or at 3rd parties (reed.co.uk or Laimoon)&apos;s websites under the course description section).</li>
                <li>Certificate fee is non-refundable and non-transferable.</li>
                <li>Please note that, in rare cases, there may be delays from the awarding body that are beyond the college&apos;s control. If such a delay occurs, we will inform you promptly and keep you updated on the status. However, the college cannot be held responsible for delays caused by the awarding body.</li>
                <li>Learners must claim their Certificate of Completion within three (3) months from the date of course completion.</li>
                <li>After the three-month period, learners must resubmit a request for certificate issuance. Approval will be subject to the current accreditation status, which may have changed.</li>
                <li>The college reserves the right to impose additional requirements or conditions for issuing certificates beyond the initial claim period.</li>
                <li>Certificates will be dispatched to the learner&apos;s provided address upon successful completion and approval of all academic and administrative requirements.</li>
                <li>The estimated standard delivery timeframes are as follows: Local postal delivery: Up to four (4) weeks (1 month) from the dispatch date. International postal delivery: Up to twelve (12) weeks (3 months) from the dispatch date.</li>
                <li>If a certificate is not delivered within standard delivery timeframe, the learner must contact us promptly to report the issue.</li>
                <li>Failure to report a non-delivery within this period will result in the college being no longer liable for the lost certificate. In such cases, the learner must apply for a duplicate certificate, which may incur additional processing fees.</li>
                <li>Delays caused by postal services, customs, or other external factors are beyond the college&apos;s control.</li>
                <li>If a certificate is lost, misplaced, or not claimed within the designated period, the learner must formally request a duplicate certificate and comply with the college&apos;s duplicate certificate issuance procedure, including any applicable fees.</li>
                <li>There is no need for previous qualifications or prior knowledge for ILC&apos;s professional courses, and anyone can enrol in the courses.</li>
                <li>Working knowledge of English language and ICT is the requirement for enrolment on all our courses.</li>
                <li>There is no age restriction for the courses, as courses are open to any learner with age over 16+ years old can apply for the course. Learners less than 16 years old will not be eligible for the CPD Certificates.</li>
                <li>ILC&apos;s Administration will contact its Learners through their own official email address and official social media pages, therefore, the college will not be responsible for any other conspiracy made on the name of Inspire London College.</li>
                <li>Our Campus based-study programs are also available, but those programmes are for the learners residing in the UK while our online and distance learning programs are open to international students.</li>
                <li>Learners are allowed to switch their course to another before taking a second unit/ module of the course if the level of the course is the same. In the case of different level learner need to pay the difference of the course fee set by the college. After taking the second unit/ module and assessment, students will not be eligible to switch the course.</li>
                <li>Learner must notify/report within 24 hours of accessing the learning material if there is any efficiencies or inaccuracies in the course material. Complaints regarding efficiencies or inaccuracies will not be accepted after this time.</li>
                <li>Necessary updates will be made to the learning material. If ILC is unable to provide learning material, a full refund will be given.</li>
                <li>Complaints can be made through email to the College&apos;s Administration, and these complaints will be addressed within 24 hours.</li>
                <li>Access to the next unit/module will be given after grading/passing of the first assignment and grading may take 5 to 7 working days.</li>
                <li>For Quiz base assessment courses(online multiple-choice test), access to the next unit/module will be given after passing the module.</li>
                <li>Online tutor is responsible for providing the feedback and results to learners within seven working days of the submission of the assignment.</li>
                <li>Delay in assignment grading process can only be caused due to technical issues, in such case learners will be informed via email.</li>
                <li>Inspire London College is not liable or responsible for any failure or disturbance in performance caused due to Force Majeure Event.</li>
                <li>Inspire London College reserves the right to change awarding organisation during the period of enrolment and certification for CPD Course. In the case of awarding organisation change, certification/diploma level will remain same as the one defined at the time of the purchase of course (from ILC website or from third-party website &apos;where ILC advertise the courses&apos;).</li>
                <li>Inspire London College reserves the right to refuse a refund, refuse to give an extension, not entitled to continue studies, receive any certification in the case of any breach of term and conditions without prior notice/communication or obligation.</li>
                <li>These terms and conditions shall be directed by and interpreted by the laws of England and Wales. Disputes arising here in between from shall be completely subject to the jurisdiction of the courts of England and Wales.</li>
              </ul>
            </div>
          </details>

          {/* 2. Certification and Learning Platform / VLE Privacy Policy */}
          <details className="group bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <summary className="flex items-center justify-between cursor-pointer list-none px-4 py-4 font-semibold text-gray-900 hover:bg-gray-50 transition-colors [&::-webkit-details-marker]:hidden border-l-4 border-[#11CCEF]">
              <span>2. Certification and Learning Platform / VLE Privacy Policy</span>
              <span className="text-[#11CCEF] group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-4 pb-4 pt-0 space-y-4 text-gray-600 leading-relaxed border-t border-gray-100">
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>The Learners data and information is completely protected as per according to the Data Protection Act 1998 & GDPR (General Data Protection Regulation Act 2018) and it will be used only for educational purposes.</li>
                <li>Information about the learner and their data will not be provided to another learner for securing his privacy.</li>
                <li>Feedback on assessments is not published publicly as College provides it directly to learner via its VLE/ Learning Platform.</li>
                <li>Upon successfully passing the CPD Course, Learner can claim the CPD Accredited Certificate of Completion from Inspire London College (either in PDF format or Hardcopy) by paying the Certificate fee via ILC.</li>
                <li>Certificate fee is non-refundable</li>
                <li>Before claiming the certificate, learners must ensure that it satisfies their requirements. Complaints regarding unsatisfactory products, such as CPD courses or regulated qualifications, will not be considered, as claiming the certificate confirms that it meets their needs. Any subsequent claims of dissatisfaction will not be accepted.</li>
                <li>Inspire London College PDF Certificate of Completion will be sent to the learner via email within 24 hours (excluding weekends) after receiving the PDF certificate fee & an acceptable photo form of identification.</li>
                <li>Please note that, in rare cases, there may be delays from the awarding body that are beyond the college&apos;s control. If such a delay occurs, we will inform you promptly and keep you updated on the status. However, the college cannot be held responsible for delays caused by the awarding body.</li>
                <li>We dispatch all our certificate using track & delivery in the case you have not received your certificate in given time by us please contact us immediately.</li>
                <li>The learner will be asked to provide his/her ID for claiming the certificate. Therefore an acceptable photo form of identification is necessary.</li>
                <li>For detailed information, please see our <Link href="/privacy-policy" className="text-[#11CCEF] hover:text-[#E51791] underline transition-colors">privacy policy</Link>.</li>
              </ul>
            </div>
          </details>

          {/* 3. Regulated Qualifications */}
          <details className="group bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <summary className="flex items-center justify-between cursor-pointer list-none px-4 py-4 font-semibold text-gray-900 hover:bg-gray-50 transition-colors [&::-webkit-details-marker]:hidden border-l-4 border-[#E51791]">
              <span>3. Terms and Conditions (Regulated Qualifications)</span>
              <span className="text-[#11CCEF] group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-4 pb-4 pt-0 space-y-4 text-gray-600 leading-relaxed border-t border-gray-100">
              <p>Terms and Conditions are the foundation of a learning contract. Being the part of Inspire London College as a learner this is a contract between &quot;learner or Learner(s)&quot; and &quot;Inspire London College (ILC)&quot;.</p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>The learner will receive the requirements for registration email within 24 – 48 hours of the course purchase. In the case you have not received requirements for registration, contact ILC via email.</li>
                <li>After fulfilling the requirements for registration, learner will receive the course registration & login details for an online portal (Learning Platform/VLE) from ILC within 24 hours. In the case, you have not received course login details, contact ILC via email.</li>
                <li>Access to VLE/Learning Platform is given only after receiving the learner&apos;s tuition fee (in full or first instalment).</li>
                <li>In case of qualifications fee payment by Instalment option, learners will need to pay their regular instalments on time, and after 3 days of pending invoice, the learners will be suspended from the course.</li>
                <li>In the case ILC agree paying the fast-track fee and the course fee by paying in instalments, learner will need to pay their regular instalments on time, and after 3 days of pending first invoice, the learners will be suspended from the course. In the case activation, learner need to pay full remaining fee. If 2 missed & late instalment of fee payment, ILC will move the learner to normal pace 6 or 8 months duration.</li>
                <li>There will be £20 fee for activation the account in the case learner suspended due to non-payment of instalment.</li>
                <li>Inspire London College will apply for certificate upon receiving the full course fee.</li>
                <li>The learner can enrol in the multiple courses & qualifications at the same time, and he/she can complete them parallel.</li>
                <li>Only fully enrolled learner are eligible to apply for the exemption/Recognition of Prior Learning (RPL)</li>
                <li>If the learner wishes to apply for the exemption from any module based on Recognition of Prior Certificated Learning or Experiential Learning. Learners must apply by filling out the RPL form along with evidence.</li>
                <li>A final decision on exemption/Recognition of Prior Learning (RPL) is subject to the awarding body&apos;s EQA approval or not approval.</li>
                <li>ILC will not forward or assess any exemption/Recognition of Prior Learning (RPL) if the tuition fee/instalments fee is due. Learner needs to clear the due balance before assessment of the RPL form assessment.</li>
                <li>Inspire London College will provide learning material via Learning Platform/VLE only.</li>
                <li>Course/Qualifications material includes all the essential learning material such as Course Units, Access to VLE/Learning Platform, Assessments, Quizzes (if require) in PDF, Microsoft Word, Excel, PowerPoint format and other useful study links.</li>
                <li>All the courses/qualifications material will be in the form of texts (images/illustrations), and there will be no video or live lectures during the course.</li>
                <li>Learners can contact their online tutor through VLE/Learning Platform or via email regarding assistance in their studies throughout the course.</li>
                <li>The minimum time required to complete an ILC Qualification, awarded through Ofqual-regulated awarding bodies, is six months, while the maximum duration is twelve months. Learners will have access to VLE/Learning Platform up to 12 months from the date of enrolment. During this period, flexibility will be given to learners for completing the course at any time. After 12 months, the learner need to pay (awarding body registration fee + assessments marking fee) in any circumstance one time only.</li>
                <li>In the case learner selected the fast track option - 4 months they have to pay in full. There will be no instalment options.</li>
                <li>In the case learner is unable to complete the qualifications with provided qualifications completion extension, he/she need to register for the qualifications by paying the full fee.</li>
                <li>Course Fee, Qualification Fee, Certification fee and registrations Fee paid is not transferable to another learner, participant or representative where the learner does not like to continue the course or the employee has left the company or is unable to continue study due to any reason. If you are in a 14-day cooling-off period and the learner has not logged in to the portal and accessed the course material, a learner can request a refund.</li>
                <li>After the completion of the qualifications and/or course maximum duration (12 months from the date of enrolment) the access to VLE/Learning Platform will be terminated without prior notice, and for further information/communication, learners can contact via email.</li>
                <li>College may extend the period up to six months with extra charges (awarding body registration fee + assessments marking fee) (if the learner has shown his/her progress, i.e., submitted assignments). A learner can contact the college for further information. Please be informed that Inspire London College reserves the right to grant extensions to the course duration.</li>
                <li>There are mandatory and optional units for this qualification. All units cover a number of topics relating to learning outcomes and credits hours.</li>
                <li>The assessment method for Regulated Qualifications is assignments/reports writing.</li>
                <li>ILC will claim Certificate from the awarding body days after final assignment/module grading by assessor & IV.</li>
                <li>Hardcopy of Certificate (where applicable) will be delivered to learner&apos;s address or PDF copy via email once received by the awarding body.</li>
                <li>Where the awarding body only issue certificate PDF format only. In the case you like to get hardcopy of your certificate there will be extra charges applied.</li>
                <li>If a learner wants to cancel or no longer wish to be on the course, then he/she will be eligible to apply for a refund (Excluding Registration, Process and Refund Charges £60) within 14 days cooling-off period according to Consumer Contract Regulations 2013. (This condition applies only if the learner has not logged in to the VLE/Learning Platform and accessed the course or have not communicated with the admissions team or online tutor via email or over the phone).</li>
                <li>At the time of registration/course purchase via a college website or third-party website, a learner needs to provide his/her accurate, complete and current information all the time for VLE/Learning Platform account and registration. Failure to do so constitutes a breach of the terms and conditions, which may result in immediate termination/suspension of VLE/Learning Platform account and registration from the course without further notice.</li>
                <li>The learner is responsible for protecting the Learning Platform/VLE&apos;s Username & Password and for any activities or actions under your password.</li>
                <li>The learner is agreed not to disclose his/her password to any third party or any other learner. Breach of this condition may result in immediate termination/suspension of learner&apos;s VLE/Learning Platform account and registration from the course without further notice.</li>
                <li>Learner must notify the college immediately upon becoming aware of any breach of security or unauthorised use of VLE/Learning Platform account.</li>
                <li>Learner cannot use a username of another learner or entity that is not lawfully accessible for their use. Learner must explicitly agree that college cannot be held liable for any loss or damage arising out of any falsifications learner make in this regard.</li>
                <li>ILC accepts the payments through; Bank Transfer, Western Union, PayPal and Credit and Debit Card, therefore any other mode of transferring the payments will not be accepted and Inspire London College will not be responsible for that.</li>
                <li>Awarding body registration fee is non-refundable.</li>
                <li>Each qualification has its entry requirements. If learner is unable to meet the early requirements ILC will reject the application/enrolment.</li>
                <li>Working knowledge of English language and ICT is the requirement for enrolment on all our courses.</li>
                <li>There is no maximum age restriction for the courses, as courses are open to any learner with age over 16+ years old can apply for the course. Learners less than 16 years old will not be eligible for the Certificates.</li>
                <li>ILC&apos;s Administration will contact its Learners through their own official email address and official social media pages, therefore, the college will not be responsible for any other conspiracy made on the name of Inspire London College.</li>
                <li>Our Campus based-study programs are also available, but those programmes are for the learners residing in the UK while our online and distance learning programs are open to international students.</li>
                <li>Learners are not allowed to switch their course to another.</li>
                <li>Learner must notify/report within 24 hours of accessing the learning material if there is any efficiencies or inaccuracies in the course material. Complaints regarding efficiencies or inaccuracies will not be accepted after this time.</li>
                <li>Learners are required to report any dissatisfaction with the course material within 24 hours of accessing it. Complaints related to unsatisfactory products, including CPD courses, or regulated qualifications, will not be considered if reported after this timeframe.</li>
                <li>Necessary updates will be made to the learning material. If ILC is unable to provide learning material, a full refund will be given.</li>
                <li>Complaints can be made through email to the College&apos;s Administration, and these complaints will be addressed within 24 hours.</li>
                <li>Access to the next unit/module will be given after grading/passing of the first assignment and grading may take 5 to 7 working days.</li>
                <li>After studying the course material, learner will have to attempt the final assignment(s) or MCQs test.</li>
                <li>The Assignment Brief containing the different questions will be available on Learning Platform/VLE. You will be assessed by ILC&apos;s Assessor. A range of assessment methods may be used. When an assessment criteria is met, it will be graded &apos;Pass&apos;. If there is further evidence required, it will be graded &apos;referred or fail&apos;, and your assessor will give feedback as to how you can meet the criteria. You can resubmit an assignment 2nd time if need to. If refer in 3rd and final attempt there will be assessment fee £30/module to pay.</li>
                <li>Learners will be enrolled in Unit/Module 1 of the course upon registration. Enrolment for subsequent units/modules will only be processed once the learner has successfully completed and passed the assignment for the preceding module.</li>
                <li>If a learner is unable to pass the assignment for any module, their enrolment in the next module will not be processed until they successfully meet the required standards for the current module.</li>
                <li>Once you submit your assignment, there will be no attempt allowed to improve the grade. If you wish to pass the assessment with a higher grade, you can submit your work/assignment via email to the online tutor to check that you are on track and have covered all the tasks before the final submission.</li>
                <li>ILC sets resubmission of assignment criteria in line with pre-established Guidelines. Resubmission of referred or late assignments may be authorised if the student has fully engaged with the assessment activities during the teaching period. An assignment that has been marked as Referred on the first on-time submission can be resubmitted and graded to a maximum Pass if the assessment has grade descriptors that require evidence of meeting agreed timelines or the ability to plan/organise time effectively.</li>
                <li>An assignment that has been marked Pass on the first on-time submission cannot be resubmitted for an opportunity for an improved grade; the grade is capped at Pass.</li>
                <li>Online tutor is responsible for providing the feedback and results to learners within seven working days of the submission of the assignment.</li>
                <li>Delay in the assignment grading process can only be caused due to technical issues, in such case learners will be informed via email.</li>
                <li>Learners are required to retain a soft copy of their assignments until course completion, even after submission on Moodle/VLE. Please note that the awarding body may request assignments as part of the quality assurance process.</li>
                <li>Inspire London College is not liable or responsible for any failure or disturbance in performance caused due to Forced Majeure Event.</li>
                <li>Inspire London College reserves the right to change awarding organisation during the period of enrolment and certification for Qualifications. In the case of awarding organisation change, certification/diploma level will remain same as the one defined at the time of the purchase of course (from ILC website or from third-party website &apos;where ILC advertise the courses&apos;).</li>
                <li>Inspire London College reserves the right to refuse a refund, refuse to give an extension, not entitled to continue studies, receive any certification in the case of any breach of terms and conditions without prior notice/communication or obligation.</li>
                <li>These terms and conditions shall be directed by and interpreted by the laws of England and Wales. Disputes arising here in between from shall be completely subject to the jurisdiction of the courts of England and Wales.</li>
              </ul>
            </div>
          </details>

          {/* 4. Medical / Phlebotomy CPD Accredited Course */}
          <details className="group bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <summary className="flex items-center justify-between cursor-pointer list-none px-4 py-4 font-semibold text-gray-900 hover:bg-gray-50 transition-colors [&::-webkit-details-marker]:hidden border-l-4 border-[#11CCEF]">
              <span>4. Terms and Conditions (Medical / Phlebotomy CPD Accredited Course)</span>
              <span className="text-[#11CCEF] group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-4 pb-4 pt-0 space-y-4 text-gray-600 leading-relaxed border-t border-gray-100">
              <p>Terms and conditions are the foundation of a learning contract. Being the part of Inspire London College & Inspire Medical as a learner this is a contract between &quot;learner or Learner(s)&quot; and &quot;Inspire London College (ILC)&quot;.</p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>The learner will receive the course booking confirmation from ILC or 3rd party within 48 hours. In the case you have not received a training booking confirmation, contact ILC via email.</li>
                <li>Course material includes all the essential learning material such as Course Units, Assessments, Quizzes (if require) in PDF, Microsoft Word, PowerPoint format and other useful study links and there will be no video.</li>
                <li>There is no need for previous qualification or prior knowledge for ILC&apos;s professional courses/CPD and anyone can enrol in the courses with a medical or non-medical background.</li>
                <li>Working knowledge of the English language is the requirement for enrolment on all our courses.</li>
                <li>If a learner wants to cancel or no longer wish to be on the course, then he/she will be eligible to apply for a full refund within 48 Hours of booking the course.</li>
                <li>Any learner with age over 17+ years old can apply for the course (phlebotomy training).</li>
                <li>Once you have booked your course and it&apos;s over 48 hours, if you like to cancel your booking, the following cancellation fees will be payable:</li>
              </ul>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200 text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-200 px-3 py-2 text-left text-[#E51791] font-semibold">Cancellation up to three days after the booking of course</th>
                      <th className="border border-gray-200 px-3 py-2 text-left text-[#E51791] font-semibold">Cancellation up to five days, after the booking of course</th>
                      <th className="border border-gray-200 px-3 py-2 text-left text-[#E51791] font-semibold">Cancellation Over five days, after the booking of course</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-200 px-3 py-2 text-gray-600">Full tuition fees refund. Cancellation fees will apply, which is £50</td>
                      <td className="border border-gray-200 px-3 py-2 text-gray-600">30% tuition fees refund. Cancellation fees will apply, which is £50</td>
                      <td className="border border-gray-200 px-3 py-2 text-gray-600">No refund. Course Cancelation fees, which is £50, will apply once you book the course via our website or 3rd party website(s).</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <ul className="list-disc list-inside space-y-2 text-sm text-gray-600">
                <li>There will be no refund issued for non-attendance on a course/booked training for the booking dates. You will need to make a new booking for the next available course by paying the course fee (at the time of rebooking) if you wish to do the course.</li>
                <li>If the reason for not attending the training/course is acceptable (due to any emergency or health issue), the Learner needs to rebook the part 2 training session (next available) by paying extra charges, which is £200 (for Part 2), to complete the course.</li>
                <li>Learner arriving more than 15 minutes late will be refused entry onto the course. And there will be no refund for the course fee or transferable to the next date(s).</li>
                <li>Learner arriving late can be allowed to attend the course in the case of the acceptable reason for arriving late and leaner will sign the declaration form at reception.</li>
                <li>Failure of Learner to attend the full course duration (left the class/session), will result in incompletion of the course, and there will be no certificate issued if the reason for leaving course is acceptable (due to any emergency or health issue), Learner needs to book the one to one training session by paying extra charges, which is £90 (for Part 1 only), to complete the course and acquire the certificate.</li>
                <li>Learner is allowed to change the booked course/Part 1 date(s) maximum 10 days before the course booked/planned date(s) without any extra fee charge for one time only.</li>
                <li>After this time (less than 10 days) to the planned course booked date(s) you will be charged an admin fee, which is £50. if the Learner needs to change the planned course booked date(s) less than 48 hours there will be no refunded or change. If you wish to take the course/training at the next available date and you will have to pay the full course fee for rebooking.</li>
                <li>Booking for the course planned date is subject to the availability of the spaces on the course.</li>
                <li>In case of course fee payment by Initial deposit (partially), learners will need to clear their remaining fee on agreed date for attending the reserved training session; there will be no confirmation of the training/course or booking of any session or refund of deposit.</li>
                <li>Inspire London College reserves the right to more you on next available training for part 1 or part 2</li>
                <li>We do not reserve the space without any course fee payment.</li>
                <li>If ILC cancels the course on a planned date(s) due to the less number of a students/learners on the course for the planned date(s) or unforeseen circumstances i.e. non-availability, illness of the trainer or any emergencies, which ILC reserves the right to do, alternative dates for the same course will be offered to the Learner.</li>
                <li>In the case of cancellation of the course dates(s), ILC will inform learners via email, phone call or text at least 24 hours before the start of the course.</li>
                <li>ILC will book the learners on to the next available course date(s), or training/ session will be provided to cover these cancellations without any extra charges.</li>
                <li>Inspire London College is not liable any costs incurred for additional, i.e. Day Off from work, Ticket booked in advanced and childcare accommodation</li>
                <li>In the event of &apos;force majeure&apos; such as fire, flooding, infectious diseases and other events outside the company&apos;s reasonable control which may cause the closure of the Institute, no extra compensation will be made to the Learner, except at the Institute&apos;s discretion in exceptional circumstances.</li>
                <li>ILC reserve the right to cancel the clinical session(s) at late notice due to unforeseen or force majeure.</li>
                <li>ILC&apos;s advanced practical session(s)/Part 2 are non- refundable.</li>
                <li>Learner is not allowed to bring children with them to class. For the safety of children, Learner is not permitted in the classroom or GP clinic during phlebotomy training sessions. In the case, if a participant arrives with a child, the trainers reserve the right to deny attendance.</li>
                <li>In the event of denied attendance due to the company of a children, learner must rebook the training (Part 1 or Part 2) and pay the full course fee again.</li>
                <li>There will be no refund issued or change of date for non-attendance/no show on a course/booked training (Part 1 & Part 2) for the booking dates.</li>
                <li>You will need to make a new booking for the next available training session(s) by paying the full fee for Part 1 & Part 2/ Practical Part training.</li>
                <li>If the reason for not attending the training/course is acceptable (due to any emergency or health issue), the Learner needs to rebook the part 2 training session (next available) by paying extra charges, which is £200 (for Part 2), to complete the course.</li>
                <li>Failure of Learner to attend the full Part 2 duration (left the training/session), will result in incompletion of the course, and there will be no certificate issued.</li>
                <li>If the reason for leaving course is acceptable (due to any emergency or health issue), Learner needs to rebook part 2 training session (next available) by paying extra charges, which is £200 (for Part 2), to complete the course and acquire the certificate.</li>
                <li>Learner needs to agree on the policies and procedures of the clinics & ILC. In the case of any breach, the session will be cancelled, and there will be no refund.</li>
                <li>ILC&apos;s clinical atmosphere session(s)/Part 2 must be booked in advance.</li>
                <li>ILC&apos;s clinical sessions/Part 2 will be booked if you fulfil the illegibility criteria.</li>
                <li>ILC&apos;s clinical sessions/Part 2 are only for the Learner who have completed Part 1 of Level 3 Certificate in Phlebotomy with us.</li>
                <li>If leaner have completed the course somewhere else and like to do part 2 of the course with us, you will have to attend our full course.</li>
                <li>Learner(s) who completed Part 1 of the Level 3 Certificate in Phlebotomy have to book the clinical sessions with us or their workplace within three months of attending the theory sessions.</li>
                <li>In the case you decide to complete the practical at your workplace, you need to make an arrangement by paying part 2 fee + accessor fee and availability of registered accessor to visit at your workplace as only our registered accessor can assess and issue you the certificate of competence.</li>
                <li>In the case of not booking Part 2 within 3 months. Learner needs to redo Part 1 training, and there will be a full course fee payable.</li>
                <li>Learner(s) are allowed to change the day/date(s) for Part 2 session(s) until 10 days before the booked day/date(s), in the case you booked your Part 2 session(s) less than 10 days before the start of the session(s) then the change sessions fee will apply, which is £250.</li>
                <li>If the request for a change session date is less than 10 days before the booked session/date(s) then the change sessions fee will apply, which is £250.</li>
                <li>There will be no refund issued or change of date for non-attendance/no show on a course/booked training (Part 2) for the booking dates due to any reason. Change sessions/rebooking fee will apply, which is £250.</li>
                <li>Our phlebotomist placement programme&apos;s deposit or fee is non-refundable, and the booked sessions are non-transferable.</li>
                <li>ILC&apos;s phlebotomist placement programme is pre-booked and pre-paid and is non-refundable/non-transferable.</li>
                <li>No refund will be issued, nor will there be a change of date for non-attendance/no-show on a phlebotomist placement programme session for the booked session(s).</li>
                <li>You will need to make a new booking for the next available session of the phlebotomist placement programme session by paying the full fee for the session(s) you would like to attend.</li>
                <li>Participants must adhere to the policies and procedures of the phlebotomist placement programme and ILC. If they breach these, the session will be cancelled, and there will be no refund.</li>
                <li>The Learners data and information is completely protected as per according to the Data Protection Act 1998 & GDPR (General Data Protection Regulation Act 2018) and it will be used only for educational purposes.</li>
                <li>Information about the Learner and their data will not be provided to another learner for securing his privacy.</li>
                <li>The Learner will be asked to provide his/her ID for claiming the certificate. Therefore an acceptable photo form of identification is necessary.</li>
                <li>Certificate will be sent to the Learner&apos;s mailing address within 15 -20 working days. Therefore correct personal information is necessary for the students, or you can collect it from our office.</li>
                <li>Inspire London College will issue you a certificate of attendance at the end of Part 1 training day.</li>
                <li>At the time of registration/course purchase via a college website or third party website, a learner needs to provide his/her accurate, complete and current information all the time.</li>
                <li>ILC will use the information provided for registration with the awarding body. In the case of any changes, there will be an extra £35 fee payable.</li>
              </ul>
            </div>
          </details>

          {/* 5. Classed Based Qualifications */}
          <details className="group bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <summary className="flex items-center justify-between cursor-pointer list-none px-4 py-4 font-semibold text-gray-900 hover:bg-gray-50 transition-colors [&::-webkit-details-marker]:hidden border-l-4 border-[#E51791]">
              <span>5. Terms and Conditions for Classed Based Qualifications (Security, First Aid, and Education & Training)</span>
              <span className="text-[#11CCEF] group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-4 pb-4 pt-0 space-y-4 text-gray-600 leading-relaxed border-t border-gray-100">
              <p>Terms and conditions are the foundation of a learning contract. Being the part of Inspire London College & Inspire Medical as a learner this is a contract between &quot;learner or Learner(s)&quot; and &quot;Inspire London College (ILC)&quot;.</p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>The learner will receive the course booking confirmation within 48 hours, whether you have purchased the course from the college website or from a 3rd party website. In the case you have not received a training booking confirmation, contact ILC via email.</li>
                <li>Course material includes all the essential learning material such as Course Units, Assessments, Quizzes (if require) in PDF, Microsoft Word, PowerPoint format and other useful study links and there will be no video.</li>
                <li>There is no need for previous qualifications or prior knowledge However, learners should have a minimum of level two in literacy and numeracy or equivalent. Working knowledge of the English language is the requirement for enrolment on all our courses. There will be an assessment at the time of registration.</li>
                <li>Any learner with age over 17+ years old can apply for the course, for further information check the requirements for specific qualifications in Requirements Tab</li>
                <li>If a learner wants to cancel or no longer wish to be on the course, then he/she will be eligible to apply for a full refund within 48 Hours of booking the course.</li>
              </ul>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200 text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-200 px-3 py-2 text-left text-[#E51791] font-semibold">Cancellation up to three days after the booking of a course</th>
                      <th className="border border-gray-200 px-3 py-2 text-left text-[#E51791] font-semibold">Cancellation up to five days, after the booking of a course</th>
                      <th className="border border-gray-200 px-3 py-2 text-left text-[#E51791] font-semibold">Cancellation Over five days, after the booking of a course</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-200 px-3 py-2 text-gray-600">Full tuition fees refund. Cancellation fees will apply, which is £50</td>
                      <td className="border border-gray-200 px-3 py-2 text-gray-600">30% tuition fees refund. Cancellation fees will apply, which is £50</td>
                      <td className="border border-gray-200 px-3 py-2 text-gray-600">No refund. Course Cancelation fees, which is £50, will apply once you book the course via our website or 3rdparty website(s).</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>There will be no refund issued for non-attendance on a course, qualification /booked training for the booking dates. You will need to make a new booking for the next available course/training by paying the course/training fee (at the time of rebooking) if you wish to do the course.</li>
                <li>Learner arriving more than 15 minutes late will be refused entry onto the course. And there will be no refund for the course fee or transferable to the next date(s).</li>
                <li>Learner arriving late can be allowed to attend the course in the case of the acceptable reason for arriving late and learner will sign the declaration form at reception.</li>
                <li>Failure of Learner to attend the full course duration (left the class/session), will result in incompletion of the course, and there will be no certificate issued if the reason for leaving course is acceptable (due to any emergency or health issue), Learner needs to book the one-to-one training session by paying extra charges, which is £30/hours, to complete the course and acquire the certificate. Charges will be calculated as per the required number of hours for the qualification.</li>
                <li>If learner need to retake the exam or re-sit for the course there will be a re-sit/retake fee applicable as First aid retake assessment & practical, £40, and for DS Security or DS Security Top-Up retake/module £90, and Education & Training 60/module</li>
                <li>Learner is allowed to change the booked course/Part 1 date(s) maximum of 10 days before the course booked/planned date(s) without any extra fee charge for one time only.</li>
                <li>After this time (less than 10 days) to the planned course booked date(s) you will be charged an admin fee, which is £50. if the Learner needs to change the planned course booked date(s) to less than 48 hours there will be no refund or change. If you wish to take the course/training on the next available date and you will have to pay the full course fee for rebooking.</li>
                <li>Booking for the course planned date is subject to the availability of the spaces on the course.</li>
                <li>In case of course fee payment by Initial deposit (partially), learners will need to clear their remaining fee 48 hours before the training date; there will be no confirmation of the course or booking of any session or refund of deposit.</li>
                <li>We do not reserve the space without any course/training fee payment.</li>
                <li>If ILC cancels the course on a planned date(s) due to the less number of a student&apos;s/learners on the course for the planned date(s) or unforeseen circumstances i.e. non-availability, illness of the trainer or any emergencies, which ILC reserves the right to do, alternative dates for the same course will be offered to the Learner.</li>
                <li>In the case of cancellation of the course dates(s), ILC will inform learners via email, phone call or text at least 24 hours before the start of the course.</li>
                <li>ILC will book the learners on to the next available course date(s), or training/ session will be provided to cover these cancellations without any extra charges.</li>
                <li>Inspire London College is not liable for any costs incurred for additional, i.e., Day Off from work, Ticket booked in advanced and childcare accommodation</li>
                <li>In the event of &apos;force Majeure&apos; such as fire, flooding, infectious diseases and other events outside the company&apos;s reasonable control which may cause the closure of the Institute, no extra compensation will be made to the Learner, except at the Institute&apos;s discretion in exceptional circumstances.</li>
                <li>ILC reserve the right to cancel the training session(s) at late notice due to unforeseen or force majeure.</li>
                <li>There will be no refund issued or change of date for non-attendance/no show on a course/booked training dates or leaning in the middle of the course/training.</li>
                <li>You will need to make a new booking for the next available training session(s) by paying the full fee in case you have to leave the training.</li>
                <li>Learner needs to agree on the policies and procedures of ILC and awarding bodies for exams and assessments. In the case of any breach, the session will be cancelled, and there will be no refund.</li>
                <li>If learner have completed the First Aid Qualifications for security training somewhere else and like to do Security Training with us, you will have to provide an original First Aid Certificate of your qualifications, or if you received a certificate by email this should be from the official email address of the provider. We only accept regulated qualifications.</li>
                <li>The Learners data and information is completely protected according to the Data Protection Act 1998 & GDPR (General Data Protection Regulation Act 2018) and it will be used only for educational purposes.</li>
                <li>Information about the Learner and their data will not be provided to another learner for securing his privacy.</li>
                <li>The Learner will be asked to provide his/her ID at the time of registration and examination. Therefore, an acceptable photo form of identification is necessary to bring along with you.</li>
                <li>A certificate will be issued by the awarding body (For further information check the certificate option of the course/training whether you will get Hard Copy or PDF. In the case Hard Copy Certificate is issued, it will be sent to the Learner&apos;s mailing address within 20 – 22 working days and if there is a PDF certificate option, we will email you upon receiving it by the awarding body. Therefore, correct personal information is necessary for the students, or you can collect it from our office (appointment need to book in advance)</li>
                <li>At the time of registration/course purchase via a college website or third-party website, a learner needs to provide his/her accurate, complete and current information all the time.</li>
                <li>ILC will use the information provided for registration with the awarding body. In the case of any changes, there will be an extra £35 fee payable.</li>
              </ul>
            </div>
          </details>

          {/* 6. VideoTile */}
          <details className="group bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <summary className="flex items-center justify-between cursor-pointer list-none px-4 py-4 font-semibold text-gray-900 hover:bg-gray-50 transition-colors [&::-webkit-details-marker]:hidden border-l-4 border-[#11CCEF]">
              <span>6. Terms and Conditions for VideoTile</span>
              <span className="text-[#11CCEF] group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-4 pb-4 pt-0 space-y-4 text-gray-600 leading-relaxed border-t border-gray-100">
              <p className="font-medium text-gray-900">TERMS AND CONDITIONS: Videotile Learning (Online CPD Courses)</p>
              <h3 className="font-semibold text-[#E51791] mt-4">Definitions:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li><strong>Course(s):</strong> e-learning content and platform software</li>
                <li><strong>Company:</strong> VideoTile Learning Ltd and its affiliates and distributors</li>
                <li><strong>Course Provider:</strong> A third party provider of the VideoTile Learning Ltd materials</li>
                <li><strong>Materials:</strong> Courses and supporting materials provided by authors (&quot;Third Party Providers&quot;)</li>
                <li><strong>Members(s):</strong> Registered Users whether corporate or private with valid login details provided by Company in return for a payment determined by Company</li>
                <li><strong>Website operation:</strong> This website delivering the Course (linked to by affiliates and distributors) is owned and operated by VideoTile Learning Ltd (In association with reputable internet service providers) registered address Westlands House, Whalley Road, Padiham, BB12 8JX, 01282 776257</li>
              </ul>
              <h3 className="font-semibold text-[#E51791] mt-4">Course Copyright</h3>
              <p>Copyright © 2011 - 2022 Videotile Learning Ltd, All rights reserved</p>
              <h3 className="font-semibold text-[#E51791] mt-4">LIMITED WARRANTY</h3>
              <p>The Company warrants that its e-learning content and platform software (the Course) will perform substantially in accordance with the accompanying written materials for a period of 1 year from the date of receipt of login details provided always that the minimum requirements of customer equipment and connectivity are available. In the event applicable law imposes any implied warranties, the implied warranty period is limited to 90 days from the date of receipt of valid login details unless statute forbids.</p>
              <h3 className="font-semibold text-[#E51791] mt-4">CUSTOMER REMEDIES</h3>
              <p>The Company&apos;s and its suppliers&apos; entire liability and Customer&apos;s exclusive remedy shall be, at the Company&apos;s option, either (a) return of the price paid for the Course, or (b) repair or correction of the Course that does not meet this Limited Warranty and which is reported to the Company with a copy of Customer&apos;s evidence of payment. This Limited Warranty is void if failure of the Course has resulted from accident, abuse, or misapplication. Any corrective remedy will be warranted for the remainder of the original warranty period or thirty days, whichever is longer.</p>
              <h3 className="font-semibold text-[#E51791] mt-4">NO OTHER WARRANTIES</h3>
              <p>To the maximum extent permitted by applicable law, the company and its suppliers disclaim all other warranties, either express or implied, including, but not limited to implied warranties of merchantability and fitness for a particular purpose, with regard to the course and any related written materials. This limited warranty gives customer specific legal rights. Customer may have other rights depending on the jurisdiction.</p>
              <h3 className="font-semibold text-[#E51791] mt-4">NO LIABILITY FOR DAMAGES</h3>
              <p>To the maximum extent permitted by applicable law, in no event shall the company or its suppliers be liable for any damages whatsoever (including without limitation, special, incidental, consequential, or indirect damages for personal injury, loss of business profits, business interruption, loss of business information, or any other pecuniary loss) arising out of the use of or inability to use this product, even if the company has been advised of the possibility of such damages. In any case, the company&apos;s and its suppliers&apos; entire liability under any provision of this agreement shall be limited to the amount actually paid by you for the course. Because some jurisdictions do not allow the exclusion or limitation of liability for consequential or incidental damages, the above limitation may not apply.</p>
              <h3 className="font-semibold text-[#E51791] mt-4">Membership restrictions</h3>
              <p>Each member upon payment of the course fee will be granted a unique user ID and password which is used to gain access to the materials therein. Under NO circumstances whatsoever may any registered user share or distribute their user IDs or passwords to third parties or display the content of the course to other non-registered members for the purpose of training. Under NO circumstances whatsoever shall members distribute the courseware contained within this site. Each course is individually licensed. Any breach of these terms will result in the immediate suspension of the account and additional charges in respect of the additional unauthorised uses of the course.</p>
              <h3 className="font-semibold text-[#E51791] mt-4">Minimum system and connectivity requirements</h3>
              <p>Members are required to have an installed working version of an operating system Microsoft Windows 10 / Mac OS X 10.8 as a minimum and Adobe Acrobat Reader version 9 or above and appropriate software, as indicated for the course. A modern and up-to-date web browser is required, you can check your browser version by visiting: https://www.whatismybrowser.com/ JavaScript must be enabled. The web pages are not guaranteed to display in any other format. Graphics card is recommended but not essential. Audio reproduction via speakers or headset is required. Standard quality minimum connected speed to the user device a minimum 3 Mb/sec is required For High quality minimum connected speed to the user device 5 Mb/sec is required and up to date video drivers are required. Minimum memory of 1GB must be available</p>
              <h3 className="font-semibold text-[#E51791] mt-4">Mobile</h3>
              <p>The content has been tested and is known to work on iOS devices from the iPad 2 onwards and iPhone 4 onwards, It has also been tested on some Android devices including the Samsung Galaxy tab II and the Kindle Fire HD. Performance may be limited by signal availability. Most other Android devices with some exceptions depending on OS version and browser used can be used. Performance may be limited by signal availability.</p>
              <h3 className="font-semibold text-[#E51791] mt-4">VideoTile Learning Ltd Privacy Policy</h3>
              <p>This privacy policy sets out how VideoTile Learning Ltd uses and protects any information that you give VideoTile Learning Ltd when you use this website. VideoTile Learning Ltd is committed to ensuring that your privacy is protected. Should we ask you to provide certain information by which you can be identified when using this website, then you can be assured that it will only be used in accordance with this privacy statement. VideoTile Learning Ltd may change this policy from time to time by updating this page. You should check this page from time to time to ensure that you are happy with any changes. This policy is effective from 1st August 2011.</p>
              <h4 className="font-semibold text-[#11CCEF] mt-3">What we collect?</h4>
              <p>We may collect the following information: Name and job title, Contact information including email address, Demographic information such as postcode, preferences and interests, Other information relevant to customer surveys and/or offers</p>
              <h4 className="font-semibold text-[#11CCEF] mt-3">What we do with the information we gather?</h4>
              <p>We require this information to understand your needs and provide you with a better service, and in particular for the following reasons: Internal record keeping. We may use the information to improve our products and services. We may periodically send promotional emails about new products, special offers or other information which we think you may find interesting using the email address which you have provided. From time to time, we may also use your information to contact you for market research purposes. We may contact you by email, phone, fax or mail. We may use the information to customise the website according to your interests.</p>
              <h4 className="font-semibold text-[#11CCEF] mt-3">Security</h4>
              <p>We are committed to ensuring that your information is secure. In order to prevent unauthorised access or disclosure, we have put in place suitable physical, electronic and managerial procedures to safeguard and secure the information we collect online. We do not store credit card details nor do we share customer details with any 3rd parties</p>
              <h4 className="font-semibold text-[#11CCEF] mt-3">How we use cookies</h4>
              <p>A cookie is a small file which asks permission to be placed on your computer&apos;s hard drive. Once you agree, the file is added and the cookie helps analyse web traffic or lets you know when you visit a particular site. Cookies allow web applications to respond to you as an individual. The web application can tailor its operations to your needs, likes and dislikes by gathering and remembering information about your preferences. We use traffic log cookies to identify which pages are being used. This helps us analyse data about web page traffic and improve our website in order to tailor it to customer needs. We only use this information for statistical analysis purposes and then the data is removed from the system. Overall, cookies help us provide you with a better website, by enabling us to monitor which pages you find useful and which you do not. A cookie in no way gives us access to your computer or any information about you, other than the data you choose to share with us. You can choose to accept or decline cookies. Most web browsers automatically accept cookies, but you can usually modify your browser setting to decline cookies if you prefer. This may prevent you from taking full advantage of the website.</p>
              <h4 className="font-semibold text-[#11CCEF] mt-3">Links to other websites</h4>
              <p>The Course material may contain links to other websites of interest. However, once you have used these links to leave our site, you should note that we do not have any control over that other website. Therefore, Company cannot be responsible for the protection and privacy of any information which you provide whilst visiting such sites and such sites are not governed by this privacy statement. Caution should be exercised particularly in relation to the privacy statement applicable to the website in question.</p>
              <h4 className="font-semibold text-[#11CCEF] mt-3">Controlling your personal information</h4>
              <p>You may choose to restrict the collection or use of your personal information in the following ways: Whenever you are asked to fill in a form on the website, look for the box that you can click to indicate that you do not want the information to be used by anybody for direct marketing purposes if you have previously agreed to us using your personal information for direct marketing purposes, you may change your mind at any time by writing to or emailing us at sales@videotile.co.uk We will not sell, distribute or lease your personal information to third parties. We may use your personal information to send you promotional information about third parties which we think you may find interesting if you tell us that you wish this to happen. You may request details of personal information which we hold about you under the Data Protection Act 1998. A small fee will be payable. If you would like a copy of the information held on you please write to Web Administrator, VideoTile Learning Ltd, Westlands House, Whalley Road, Padiham, BB12 8JX. If you believe that any information we are holding on you is incorrect or incomplete, please write to or email us as soon as possible, at the above address. We will promptly correct any information found to be incorrect.</p>
              <h3 className="font-semibold text-[#E51791] mt-4">VideoTile E learning Delivery Policy</h3>
              <p>When you have purchased your product via the payment link to PayPal you will receive to the email address you used with PayPal to complete your purchase, within not more than 24 hours, an email containing a link to an administration page together with log in details and instructions to enable you to use and administer the content you have purchased. If you paid with an &quot;PayPal- eCheck&quot;, please note that the delivery is not instant. This process takes 3-8 business days to clear with PayPal. Once the payment is cleared, an email is automatically sent to your PayPal-connected email address with your access instructions. The e learning content is made available immediately after payment has been authorized, verified, and cleared to the VideoTile Ltd. bank account. VideoTile Learning Ltd will make reasonable efforts to complete the anti-fraud verification process as quickly as possible, however actual verification depends upon billing information provided to PayPal and may take up to several days for verification. E learning content is delivered to you by providing access to web pages containing the e learning video and other content and functionality only.</p>
              <h3 className="font-semibold text-[#E51791] mt-4">E learning Refund & Cancellation Policy</h3>
              <p>If technical problems stop you from accessing the content you have purchased our support team will be try to help you resolve the problem. You are required to have a functioning internet connection and equipment to enable you to view video files delivered over the internet. Providing you have the required connection and equipment and we are unable to resolve the problem with you, you will receive a full refund for all unused content purchased. Used content is that for which a course certificate has been issued.</p>
              <h3 className="font-semibold text-[#E51791] mt-4">Refund Policy</h3>
              <p>The VideoTile refund policy complies with the EU Distance Selling Directive (2000) and is part of UK law under the Consumer Protection Regulations (2000) that relate to distance selling. The law came into force in the year 2000 and applies to all UK based transactions where the consumer doesn&apos;t meet the vendor. These regulations do not govern contracts between businesses.</p>
              <h4 className="font-semibold text-[#11CCEF] mt-3">Consumer Rights</h4>
              <p>In accordance with the above law, you have a 7 day cooling off period during which you have the right to cancel your purchase and receive a refund. You don&apos;t need to give a reason to cancel your purchase. If you do decide to cancel, we will refund your payment within 30 days of your cancellation.</p>
              <h4 className="font-semibold text-[#11CCEF] mt-3">Refund Conditions</h4>
              <p>All access to the VideoTile e learning website is governed by a unique username and password. The username and password is part of a system which protects the security of the resource and enables VideoTile Learning Ltd to monitor usage by any individual. When a refund request is received, VideoTile Learning Ltd reserves the right to track the usage by an individual (through his/her username and password) of: Specific pages viewed, Frequency of use, Time period of use, Certificates issued, IP address used. No refund will be granted if VideoTile Learning Ltd has reason to believe that an individual has viewed any of the information that they purchased. VideoTile Learning Ltd reserves the right to charge a handling fee (15% of the original fee).</p>
              <h4 className="font-semibold text-[#11CCEF] mt-3">How to Cancel Within 7 Days of Purchase</h4>
              <p>Should you wish to cancel your purchase within the 7 day cooling off period, please email us at sales@videotile.co.uk or write to us at the following address: E Learning Department, VideoTile Learning Ltd, Westlands House, Whalley Road, Padiham, BB12 8JX</p>
              <h4 className="font-semibold text-[#11CCEF] mt-3">Refunds Following Cancellation</h4>
              <p>If you do cancel your purchase within the 7 day cooling off period then we will refund your payment. If you paid by credit or debit card from our website, your refund will be made directly to your credit or debit card within 30 days of your cancellation. If you paid by any other means then your refund will be made by cheque, this will be posted to you within 30 days of your cancellation.</p>
              <h3 className="font-semibold text-[#E51791] mt-4">GOVERNING LAW AND JURISDICTION</h3>
              <p>These terms shall be governed by and construed in accordance with the laws of England and any dispute shall be subject to the non-exclusive jurisdiction of the English courts.</p>
            </div>
          </details>
        </div>

        <p className="mt-8 text-gray-500 text-sm italic">
          Changes in the terms and conditions will be posted on our Website. You are advised to check our college website regularly to view our most recent policies.
        </p>

        <div className="mt-10 pt-6 border-t border-gray-200 flex flex-wrap gap-3">
          <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 bg-[#11CCEF] hover:bg-[#0db8d9] text-white font-medium rounded-lg transition-colors text-sm">
            ← Back to Home
          </Link>
          <Link href="/privacy-policy" className="inline-flex items-center px-4 py-2 border border-[#E51791] text-[#E51791] hover:bg-[#E51791] hover:text-white font-medium rounded-lg transition-colors text-sm">
            Privacy Policy
          </Link>
          <Link href="/cookie-policy" className="inline-flex items-center px-4 py-2 border border-[#11CCEF] text-[#11CCEF] hover:bg-[#11CCEF] hover:text-white font-medium rounded-lg transition-colors text-sm">
            Cookie Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
