'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiService } from '@/app/services/api';
import { showSweetAlert } from '@/app/components/SweetAlert';
import { showToast } from '@/app/components/Toast';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

function autoDetectLevel(courseTitle: string | undefined): string | null {
  if (!courseTitle) return null;
  const m = courseTitle.match(/\blevel\s*(\d+)\b/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (n < 1 || n > 7) return null;
  return String(n);
}

interface Course {
  id: number;
  title: string;
}

interface Certificate {
  id: number;
  certificate_name: string;
}

interface LevelCourse {
  id: number;
  level: string;
  course_name: string;
}

interface Pricing {
  id: number;
  level_name: string;
  certificate_type: string;
  base_price: number;
  normal_courier_price: number;
  special_courier_price: number;
}

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#1a1a2e',
      fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
      fontSmoothing: 'antialiased',
      fontSize: '16px',
      '::placeholder': {
        color: '#8898aa',
      },
    },
    invalid: {
      color: '#E51791',
      iconColor: '#E51791',
    },
  },
};

function CheckoutForm({ 
  claimId, 
  totalPrice, 
  onSuccess 
}: { 
  claimId: number; 
  totalPrice: number; 
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Create payment intent
      const { success, clientSecret, paymentIntentId } = await apiService.createPaymentIntent(
        claimId,
        totalPrice
      );

      if (!success || !clientSecret) {
        throw new Error('Failed to create payment intent');
      }

      // Confirm card payment
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: elements.getElement(CardElement)!,
          },
        }
      );

      if (stripeError) {
        setError(stripeError.message || 'Payment failed');
        showToast(stripeError.message || 'Payment failed', 'error');
        setProcessing(false);
        return;
      }

      if (paymentIntent?.status === 'succeeded') {
        // Confirm payment on backend
        await apiService.confirmCertificatePayment(claimId, paymentIntentId);
        
        showSweetAlert(
          'Payment Successful!',
          'Your certificate claim has been processed. You will receive your certificate within 5-7 business days.',
          'success'
        );
        
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Payment failed');
      showToast('error', err.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-3">
          Card Details
        </label>
        <div className="border-2 border-[#E51791]/20 rounded-2xl p-5 bg-gradient-to-br from-white to-[#E51791]/5 shadow-lg shadow-[#E51791]/10 focus-within:border-[#11CCEF] focus-within:ring-4 focus-within:ring-[#11CCEF]/20 focus-within:shadow-xl focus-within:shadow-[#11CCEF]/20 transition-all duration-300">
          <CardElement options={CARD_ELEMENT_OPTIONS} />
        </div>
      </div>

      {error && (
        <div className="p-5 bg-gradient-to-r from-[#E51791]/10 to-[#E51791]/5 border-l-4 border-[#E51791] rounded-xl">
          <p className="text-sm text-[#E51791] font-medium flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </p>
        </div>
      )}

      <div className="bg-gradient-to-br from-[#11CCEF]/10 via-[#E51791]/5 to-[#11CCEF]/10 p-6 rounded-2xl border border-[#11CCEF]/30 shadow-inner">
        <div className="flex justify-between items-center">
          <span className="text-lg font-bold text-gray-800">Total Amount:</span>
          <span className="text-3xl font-black bg-gradient-to-r from-[#11CCEF] to-[#E51791] bg-clip-text text-transparent">
            £{totalPrice.toFixed(2)}
          </span>
        </div>
      </div>

      <button
        type="submit"
        disabled={!stripe || processing}
        className={`w-full py-5 px-6 rounded-2xl font-bold text-lg transition-all duration-300 transform hover:scale-[1.01] ${
          !stripe || processing
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-gradient-to-r from-[#11CCEF] to-[#E51791] text-white shadow-xl shadow-[#E51791]/30 hover:shadow-2xl hover:shadow-[#E51791]/40 hover:from-[#E51791] hover:to-[#11CCEF]'
        }`}
      >
        {processing ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin h-6 w-6 mr-3" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Processing Payment...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-3">
            Pay £{totalPrice.toFixed(2)}
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </span>
        )}
      </button>

      <div className="flex items-center justify-center gap-2 text-xs">
        <div className="w-8 h-8 bg-gradient-to-r from-[#11CCEF] to-[#E51791] rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <span className="text-gray-500 font-medium">Secured by Stripe • We never store your card details</span>
      </div>
    </form>
  );
}

export default function ClaimCertificatePage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params?.courseId as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [course, setCourse] = useState<Course | null>(null);
  const [user, setUser] = useState<any>(null);

  // Form state
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [photoId, setPhotoId] = useState<File | null>(null);
  const [postalAddress, setPostalAddress] = useState('');
  const [cpdCourseLevel, setCpdCourseLevel] = useState('');
  const [certificateType, setCertificateType] = useState<'certificate' | 'level' | ''>('');
  const [selectedCertificate, setSelectedCertificate] = useState('');
  const [selectedCourseName, setSelectedCourseName] = useState('');
  const [deliveryOption, setDeliveryOption] = useState('');
  const [courierType, setCourierType] = useState('');

  // Data from API
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [levelCourses, setLevelCourses] = useState<LevelCourse[]>([]);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [deliveryBaseByOption, setDeliveryBaseByOption] = useState<Record<string, number>>({});

  // Payment state
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [claimId, setClaimId] = useState<number | null>(null);
  const [totalPrice, setTotalPrice] = useState(0);
  const [cpdLevelAutoDetected, setCpdLevelAutoDetected] = useState(false);
  const [stripePublishableKey, setStripePublishableKey] = useState(
    () => process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
  );
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);

  const didAutoPickCourse = useRef(false);

  // Load initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('lms-token');
        if (!token) {
          router.push('/');
          return;
        }

        const userData = JSON.parse(localStorage.getItem('lms-user') || '{}');
        setUser(userData);
        setFullName(userData.name || '');
        setEmail(userData.email || '');

        // Check if student has already claimed a certificate for this course
        const claimsResponse = await apiService.getMyMyCertificateClaims();
        if (claimsResponse.success) {
          const existingClaim = claimsResponse.claims.find(
            (claim: any) => claim.course_id === parseInt(courseId) && claim.payment_status === 'completed'
          );
          
          if (existingClaim) {
            // Already claimed - redirect to certificates page
            showSweetAlert(
              'Certificate Already Claimed',
              'You have already claimed a certificate for this course. Redirecting to your certificates page...',
              'info',
              {
                confirmButtonText: 'View My Certificates',
                onConfirm: () => {
                  router.push('/dashboard/student/certificates');
                }
              }
            );
            // Auto redirect after 2 seconds
            setTimeout(() => {
              router.push('/dashboard/student/certificates');
            }, 2000);
            return;
          }
        }

        // Fetch course details
        const courseResponse = await apiService.getCPDCourseForStudent(parseInt(courseId), userData.id);
        if (courseResponse.success && courseResponse.course) {
          const c = courseResponse.course;
          setCourse(c);
          const detected = autoDetectLevel(c.title);
          if (detected) {
            const levelLabel = `Level ${detected}`;
            setCpdCourseLevel(levelLabel);
            setCertificateType('level');
            setCpdLevelAutoDetected(true);
          }
        }

        // Fetch certificates catalog
        const certResponse = await apiService.getCertificateCatalog();
        if (certResponse.success) {
          setCertificates(certResponse.certificates);
        }
      } catch {
        showToast('Failed to load form data', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [courseId, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiService.getStripeConfig();
        if (!cancelled && data?.success && typeof data.publishableKey === 'string' && data.publishableKey.trim()) {
          setStripePublishableKey(data.publishableKey.trim());
        }
      } catch {
        // keep env fallback
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const pk = stripePublishableKey.trim();
    if (!pk) {
      setStripePromise(null);
      return;
    }
    setStripePromise(loadStripe(pk));
  }, [stripePublishableKey]);

  // Load level courses when level is selected
  useEffect(() => {
    const loadLevelCourses = async () => {
      if (certificateType === 'level' && cpdCourseLevel) {
        try {
          const response = await apiService.getLevelCourses(cpdCourseLevel);
          if (response.success) {
            setLevelCourses(response.courses);
          }
        } catch {
        }
      }
    };

    loadLevelCourses();
  }, [cpdCourseLevel, certificateType]);

  useEffect(() => {
    didAutoPickCourse.current = false;
  }, [cpdCourseLevel]);

  useEffect(() => {
    if (didAutoPickCourse.current || !course?.title || levelCourses.length === 0) {
      return;
    }
    const exact = levelCourses.find(
      (lc) => (lc.course_name || '').trim() === (course.title || '').trim()
    );
    if (exact) {
      setSelectedCourseName(exact.course_name);
      didAutoPickCourse.current = true;
    }
  }, [levelCourses, course?.title]);

  // Prefetch base price for each delivery type
  useEffect(() => {
    if (!cpdCourseLevel) {
      setDeliveryBaseByOption({});
      return;
    }
    const levelForPricing = cpdCourseLevel === 'Certificate' ? 'General' : cpdCourseLevel;
    let cancelled = false;
    (async () => {
      const types = ['Hardcopy+PDF', 'Hardcopy', 'Softcopy'] as const;
      const next: Record<string, number> = {};
      for (const t of types) {
        try {
          const res = await apiService.getCertificatePricing(levelForPricing, t);
          if (res.success && res.pricing) {
            next[t] = Number(res.pricing.base_price);
          }
        } catch {
          // Row missing or inactive
        }
      }
      if (!cancelled) {
        setDeliveryBaseByOption(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cpdCourseLevel]);

  // Calculate pricing when delivery options change
  useEffect(() => {
    const calculatePricing = async () => {
      if (!deliveryOption || !cpdCourseLevel) return;

      try {
        const levelForPricing = cpdCourseLevel === 'Certificate' ? 'General' : cpdCourseLevel;
        
        const response = await apiService.getCertificatePricing(levelForPricing, deliveryOption);
        if (response.success) {
          setPricing(response.pricing);
        }
      } catch (error) {
        console.error('Error fetching pricing:', error);
      }
    };

    calculatePricing();
  }, [deliveryOption, cpdCourseLevel]);

  // Calculate total price
  useEffect(() => {
    if (!pricing) {
      setTotalPrice(0);
      return;
    }

    let total = Number(pricing.base_price);

    if (deliveryOption === 'Hardcopy+PDF' || deliveryOption === 'Hardcopy') {
      if (courierType === 'normal') {
        total += Number(pricing.normal_courier_price);
      } else if (courierType === 'special') {
        total += Number(pricing.special_courier_price);
      }
    }

    setTotalPrice(total);
  }, [pricing, deliveryOption, courierType]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        showToast('Please upload only JPG, JPEG, PNG, or PDF files', 'error');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast('File size must be less than 5MB', 'error');
        return;
      }
      setPhotoId(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!fullName || !email || !phoneNumber || !dateOfBirth || !photoId || !postalAddress) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    if (!cpdCourseLevel) {
      showToast('Please select a CPD course level', 'error');
      return;
    }

    if (!certificateType) {
      showToast('Please select certificate or level', 'error');
      return;
    }

    if (certificateType === 'certificate' && !selectedCertificate) {
      showToast('Please select a certificate', 'error');
      return;
    }

    if (certificateType === 'level' && !selectedCourseName) {
      showToast('Please select a course', 'error');
      return;
    }

    if (!deliveryOption) {
      showToast('Please select a delivery option', 'error');
      return;
    }

    if ((deliveryOption === 'Hardcopy+PDF' || deliveryOption === 'Hardcopy') && !courierType) {
      showToast('Please select a courier type', 'error');
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('studentId', user.id.toString());
      formData.append('courseId', courseId);
      formData.append('fullName', fullName);
      formData.append('phoneNumber', phoneNumber);
      formData.append('email', email);
      formData.append('dateOfBirth', dateOfBirth);
      formData.append('photoId', photoId);
      formData.append('postalAddress', postalAddress);
      formData.append('cpdCourseLevel', cpdCourseLevel);
      formData.append('certificateName', certificateType === 'certificate' ? selectedCertificate : '');
      formData.append('selectedCourseName', certificateType === 'level' ? selectedCourseName : '');
      formData.append('certificateType', deliveryOption);
      formData.append('basePrice', pricing?.base_price.toString() || '0');
      formData.append('courierType', courierType);
      formData.append(
        'courierPrice',
        courierType === 'normal'
          ? (pricing?.normal_courier_price.toString() || '0')
          : courierType === 'special'
          ? (pricing?.special_courier_price.toString() || '0')
          : '0'
      );
      formData.append('totalPrice', totalPrice.toString());

      const response = await apiService.submitCPDCertificateClaim(formData);

      if (response.success && response.requiresPayment) {
        setClaimId(response.claimId);
        setShowPaymentForm(true);
        showToast('Certificate claim submitted. Please complete payment.', 'success');
      } else {
        showSweetAlert(
          'Success!',
          'Certificate claim submitted successfully',
          'success',
          {
            onConfirm: () => router.push(`/dashboard/student/cpd/${courseId}`)
          }
        );
      }
    } catch (error: any) {
      if (error.message && error.message.includes('already claimed')) {
        showSweetAlert(
          'Certificate Already Claimed',
          error.message || 'You have already claimed a certificate for this course.',
          'warning',
          {
            confirmButtonText: 'View My Certificates',
            onConfirm: () => {
              router.push('/dashboard/student/certificates');
            }
          }
        );
      } else {
        showToast('error', error.message || 'Failed to submit certificate claim');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentSuccess = () => {
    router.push(`/dashboard/student/cpd/${courseId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#E51791]/10 via-white to-[#11CCEF]/10 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-[#E51791]/20 border-t-[#E51791] mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-10 w-10 bg-gradient-to-r from-[#11CCEF] to-[#E51791] rounded-full opacity-30 animate-pulse"></div>
            </div>
          </div>
          <p className="mt-8 text-gray-700 font-semibold text-lg">Loading your certificate claim...</p>
          <p className="text-sm text-gray-500 mt-2">Preparing your personalized experience</p>
        </div>
      </div>
    );
  }

  if (showPaymentForm && claimId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#E51791]/10 via-white to-[#11CCEF]/10 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl shadow-[#E51791]/20 p-8 border-2 border-[#E51791]/20">
            <div className="mb-8">
              <button
                onClick={() => setShowPaymentForm(false)}
                className="text-[#11CCEF] hover:text-[#E51791] flex items-center gap-3 font-bold transition-all duration-300 group"
              >
                <div className="w-8 h-8 bg-gradient-to-r from-[#11CCEF] to-[#E51791] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-5 h-5 text-white transform group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </div>
                Back to Form
              </button>
            </div>

            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-[#11CCEF] to-[#E51791] rounded-2xl mb-6 shadow-xl shadow-[#E51791]/30 transform rotate-3 hover:rotate-0 transition-transform">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h1 className="text-4xl font-black bg-gradient-to-r from-[#11CCEF] to-[#E51791] bg-clip-text text-transparent mb-3">
                Complete Payment
              </h1>
              <p className="text-gray-600 text-lg">
                Secure your certificate with a quick payment
              </p>
            </div>

            {!stripePromise ? (
              <div className="py-16 text-center">
                <div className="animate-spin rounded-full h-14 w-14 border-4 border-[#E51791]/20 border-t-[#E51791] mx-auto mb-6" />
                <p className="text-gray-700 font-medium">Loading secure payment gateway...</p>
                {!stripePublishableKey && (
                  <div className="mt-6 p-5 bg-gradient-to-r from-[#E51791]/10 to-[#E51791]/5 border-l-4 border-[#E51791] rounded-xl">
                    <p className="text-sm text-[#E51791] font-semibold">⚠️ Stripe publishable key is not configured.</p>
                  </div>
                )}
              </div>
            ) : (
              <Elements stripe={stripePromise}>
                <CheckoutForm
                  claimId={claimId}
                  totalPrice={totalPrice}
                  onSuccess={handlePaymentSuccess}
                />
              </Elements>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E51791]/10 via-white to-[#11CCEF]/10 py-12 px-4">
      {/* Decorative Background Elements */}
      <div className="fixed top-20 left-10 w-72 h-72 bg-[#E51791] rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
      <div className="fixed top-40 right-10 w-72 h-72 bg-[#11CCEF] rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
      <div className="fixed bottom-20 left-1/2 w-72 h-72 bg-[#61CE70] rounded-full mix-blend-multiply filter blur-3xl opacity-5 animate-blob animation-delay-4000"></div>

      <div className="max-w-4xl mx-auto relative z-10">
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl shadow-[#E51791]/20 p-8 border-2 border-[#E51791]/20">
          
          {/* Header */}
          <div className="mb-10">
            <button
              onClick={() => router.push(`/dashboard/student/cpd/${courseId}`)}
              className="text-[#11CCEF] hover:text-[#E51791] flex items-center gap-3 font-bold transition-all duration-300 group mb-6"
            >
              <div className="w-8 h-8 bg-gradient-to-r from-[#11CCEF] to-[#E51791] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5 text-white transform group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </div>
              Back to Course
            </button>

            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-[#11CCEF] to-[#E51791] rounded-2xl flex items-center justify-center shadow-xl shadow-[#E51791]/30 transform -rotate-6 hover:rotate-0 transition-transform">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h1 className="text-4xl font-black bg-gradient-to-r from-[#11CCEF] to-[#E51791] bg-clip-text text-transparent mb-2">
                  Claim Certificate
                </h1>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-1.5 bg-gradient-to-b from-[#11CCEF] to-[#E51791] rounded-full"></div>
                  <p className="text-gray-700 font-semibold text-lg">{course?.title}</p>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Personal Information Section */}
            <div className="bg-gradient-to-br from-white to-[#11CCEF]/5 rounded-2xl p-7 border-2 border-[#11CCEF]/20 shadow-lg">
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                <span className="w-10 h-10 bg-gradient-to-br from-[#11CCEF] to-[#E51791] rounded-xl flex items-center justify-center text-white font-bold shadow-md">1</span>
                <span className="bg-gradient-to-r from-[#11CCEF] to-[#E51791] bg-clip-text text-transparent">Personal Information</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="group">
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Full Name <span className="text-[#E51791] text-lg">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-[#11CCEF]/30 focus:border-[#11CCEF] transition-all bg-white/90 backdrop-blur-sm group-hover:border-[#11CCEF]/50 pl-12"
                      placeholder="As displayed on certificate"
                      required
                    />
                    <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#11CCEF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </div>

                <div className="group">
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Phone Number <span className="text-[#E51791] text-lg">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-[#11CCEF]/30 focus:border-[#11CCEF] transition-all bg-white/90 backdrop-blur-sm group-hover:border-[#11CCEF]/50 pl-12"
                      placeholder="Enter your phone number"
                      required
                    />
                    <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#11CCEF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                </div>

                <div className="group">
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Email <span className="text-[#E51791] text-lg">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-[#11CCEF]/30 focus:border-[#11CCEF] transition-all bg-white/90 backdrop-blur-sm group-hover:border-[#11CCEF]/50 pl-12"
                      placeholder="Enter your email"
                      required
                    />
                    <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#11CCEF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 7.89a2 2 0 002.828 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>

                <div className="group">
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Date of Birth <span className="text-[#E51791] text-lg">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-[#11CCEF]/30 focus:border-[#11CCEF] transition-all bg-white/90 backdrop-blur-sm group-hover:border-[#11CCEF]/50 pl-12"
                      required
                    />
                    <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#11CCEF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Document Upload Section */}
            <div className="bg-gradient-to-br from-white to-[#E51791]/5 rounded-2xl p-7 border-2 border-[#E51791]/20 shadow-lg">
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                <span className="w-10 h-10 bg-gradient-to-br from-[#E51791] to-[#11CCEF] rounded-xl flex items-center justify-center text-white font-bold shadow-md">2</span>
                <span className="bg-gradient-to-r from-[#E51791] to-[#11CCEF] bg-clip-text text-transparent">Document Upload</span>
              </h2>
              
              <div className="space-y-7">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">
                    Government Issued Photo ID <span className="text-[#E51791] text-lg">*</span>
                  </label>
                  <div className="relative group">
                    <input
                      type="file"
                      onChange={handleFileChange}
                      accept=".jpg,.jpeg,.png,.pdf"
                      className="w-full px-5 py-5 border-2 border-dashed border-[#E51791]/30 rounded-xl focus:ring-4 focus:ring-[#E51791]/20 focus:border-[#E51791] transition-all bg-white/90 backdrop-blur-sm file:mr-5 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-gradient-to-r file:from-[#11CCEF] file:to-[#E51791] file:text-white hover:file:shadow-xl file:transition-all file:cursor-pointer cursor-pointer"
                      required
                    />
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-gradient-to-r from-[#11CCEF] to-[#E51791] text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
                        Click to upload
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 p-3 bg-[#11CCEF]/5 rounded-xl border border-[#11CCEF]/20">
                    <svg className="w-5 h-5 text-[#11CCEF] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-gray-600">Only JPG, JPEG, PNG, or PDF files. Max size: 5MB</p>
                  </div>
                  {photoId && (
                    <div className="mt-4 flex items-center gap-3 p-4 bg-gradient-to-r from-[#61CE70]/10 to-[#61CE70]/5 rounded-xl border-l-4 border-[#61CE70]">
                      <div className="w-8 h-8 bg-[#61CE70] rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-gray-800">
                        Selected: {photoId.name}
                      </p>
                    </div>
                  )}
                </div>

                <div className="group">
                  <label className="block text-sm font-bold text-gray-700 mb-3">
                    Postal Address <span className="text-[#E51791] text-lg">*</span>
                  </label>
                  <div className="relative">
                    <textarea
                      value={postalAddress}
                      onChange={(e) => setPostalAddress(e.target.value)}
                      rows={3}
                      className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-[#11CCEF]/30 focus:border-[#11CCEF] transition-all bg-white/90 backdrop-blur-sm resize-none group-hover:border-[#11CCEF]/50 pl-12"
                      placeholder="Enter your full postal address"
                      required
                    />
                    <svg className="absolute left-4 top-5 w-5 h-5 text-[#11CCEF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Certificate Details Section */}
            <div className="bg-gradient-to-br from-white to-[#11CCEF]/5 rounded-2xl p-7 border-2 border-[#11CCEF]/20 shadow-lg">
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                <span className="w-10 h-10 bg-gradient-to-br from-[#11CCEF] to-[#E51791] rounded-xl flex items-center justify-center text-white font-bold shadow-md">3</span>
                <span className="bg-gradient-to-r from-[#11CCEF] to-[#E51791] bg-clip-text text-transparent">Certificate Details</span>
              </h2>
              
              <div className="space-y-6">
                <div className="group">
                  <label className="block text-sm font-bold text-gray-700 mb-3">
                    CPD Course Level / Certificate <span className="text-[#E51791] text-lg">*</span>
                  </label>
                  <select
                    value={cpdCourseLevel}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCpdLevelAutoDetected(false);
                      setCpdCourseLevel(value);
                      setSelectedCertificate('');
                      setSelectedCourseName('');
                      
                      if (value === 'Certificate') {
                        setCertificateType('certificate');
                      } else if (value) {
                        setCertificateType('level');
                      } else {
                        setCertificateType('');
                      }
                    }}
                    className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-[#11CCEF]/30 focus:border-[#11CCEF] transition-all bg-white/90 backdrop-blur-sm group-hover:border-[#11CCEF]/50 cursor-pointer"
                    required
                  >
                    <option value="">Select Option</option>
                    <option value="Certificate">🎓 Certificate (All Levels)</option>
                    <optgroup label="━━━ Level-Based Courses ━━━">
                      {['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5', 'Level 6', 'Level 7'].map(
                        (level) => (
                          <option key={level} value={level}>
                            📚 {level}
                          </option>
                        )
                      )}
                    </optgroup>
                  </select>
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <svg className="w-4 h-4 text-[#11CCEF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {cpdCourseLevel === 'Certificate' 
                      ? 'Choose from all available certificates' 
                      : cpdCourseLevel 
                      ? `Choose from ${cpdCourseLevel} specific courses`
                      : 'Select Certificate or a specific Level'
                    }
                  </p>
                  {cpdLevelAutoDetected && cpdCourseLevel && certificateType === 'level' && (
                    <div className="mt-4 p-5 bg-gradient-to-r from-[#11CCEF]/10 to-[#11CCEF]/5 border-l-4 border-[#11CCEF] rounded-xl">
                      <p className="text-sm text-[#11CCEF] font-bold flex items-center gap-3">
                        <div className="w-6 h-6 bg-[#11CCEF] rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        Level auto-detected from your enrolled course. You can change it if needed.
                      </p>
                    </div>
                  )}
                </div>

                {certificateType === 'certificate' && (
                  <div className="group">
                    <label className="block text-sm font-bold text-gray-700 mb-3">
                      Select Certificate <span className="text-[#E51791] text-lg">*</span>
                    </label>
                    <select
                      value={selectedCertificate}
                      onChange={(e) => setSelectedCertificate(e.target.value)}
                      className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-[#11CCEF]/30 focus:border-[#11CCEF] transition-all bg-white/90 backdrop-blur-sm group-hover:border-[#11CCEF]/50 cursor-pointer"
                      required
                    >
                      <option value="">Choose Certificate</option>
                      {certificates.map((cert) => (
                        <option key={cert.id} value={cert.certificate_name}>
                          🏆 {cert.certificate_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {certificateType === 'level' && levelCourses.length > 0 && (
                  <div className="group">
                    <label className="block text-sm font-bold text-gray-700 mb-3">
                      Select Course <span className="text-[#E51791] text-lg">*</span>
                    </label>
                    <select
                      value={selectedCourseName}
                      onChange={(e) => setSelectedCourseName(e.target.value)}
                      className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-[#11CCEF]/30 focus:border-[#11CCEF] transition-all bg-white/90 backdrop-blur-sm group-hover:border-[#11CCEF]/50 cursor-pointer"
                      required
                    >
                      <option value="">Choose Course</option>
                      {levelCourses.map((course) => (
                        <option key={course.id} value={course.course_name}>
                          📖 {course.course_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Delivery Options Section */}
            {(certificateType === 'certificate' || certificateType === 'level') && (
              <div className="bg-gradient-to-br from-white to-[#E51791]/5 rounded-2xl p-7 border-2 border-[#E51791]/20 shadow-lg">
                <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                  <span className="w-10 h-10 bg-gradient-to-br from-[#E51791] to-[#11CCEF] rounded-xl flex items-center justify-center text-white font-bold shadow-md">4</span>
                  <span className="bg-gradient-to-r from-[#E51791] to-[#11CCEF] bg-clip-text text-transparent">Delivery Options</span>
                </h2>
                
                <div className="space-y-6">
                  <div className="group">
                    <label className="block text-sm font-bold text-gray-700 mb-3">
                      Delivery Option <span className="text-[#E51791] text-lg">*</span>
                    </label>
                    <select
                      value={deliveryOption}
                      onChange={(e) => setDeliveryOption(e.target.value)}
                      className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-[#11CCEF]/30 focus:border-[#11CCEF] transition-all bg-white/90 backdrop-blur-sm group-hover:border-[#11CCEF]/50 cursor-pointer"
                      required
                    >
                      <option value="">Select Delivery Type</option>
                      <option value="Hardcopy+PDF">
                        📦📄 CPD Hardcopy+Softcopy
                        {deliveryBaseByOption['Hardcopy+PDF'] !== undefined
                          ? deliveryBaseByOption['Hardcopy+PDF'] > 0
                            ? ` - £${deliveryBaseByOption['Hardcopy+PDF'].toFixed(2)}`
                            : ' - FREE ✨'
                          : ''}
                      </option>
                      <option value="Hardcopy">
                        📄 CPD Hardcopy Certificate
                        {deliveryBaseByOption['Hardcopy'] !== undefined
                          ? deliveryBaseByOption['Hardcopy'] > 0
                            ? ` - £${deliveryBaseByOption['Hardcopy'].toFixed(2)}`
                            : ' - FREE ✨'
                          : ''}
                      </option>
                      <option value="Softcopy">
                        💾 CPD Softcopy (PDF Format)
                        {deliveryBaseByOption['Softcopy'] !== undefined
                          ? deliveryBaseByOption['Softcopy'] > 0
                            ? ` - £${deliveryBaseByOption['Softcopy'].toFixed(2)}`
                            : ' - FREE ✨'
                          : ''}
                      </option>
                    </select>
                  </div>

                  {(deliveryOption === 'Hardcopy+PDF' || deliveryOption === 'Hardcopy') && (
                    <div className="group">
                      <label className="block text-sm font-bold text-gray-700 mb-3">
                        Courier Type <span className="text-[#E51791] text-lg">*</span>
                      </label>
                      <select
                        value={courierType}
                        onChange={(e) => setCourierType(e.target.value)}
                        className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-[#11CCEF]/30 focus:border-[#11CCEF] transition-all bg-white/90 backdrop-blur-sm group-hover:border-[#11CCEF]/50 cursor-pointer"
                        required
                      >
                        <option value="">Select Courier Service</option>
                        <option value="normal">
                          🚚 Normal Courier Delivery - £{Number(pricing?.normal_courier_price ?? 0).toFixed(2)}
                        </option>
                        <option value="special">
                          ✈️ Special International Courier - £{Number(pricing?.special_courier_price ?? 0).toFixed(2)}
                        </option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Price Summary */}
            {pricing && deliveryOption && (
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-[#11CCEF] to-[#E51791] rounded-2xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity"></div>
                <div className="relative bg-white rounded-2xl p-7 shadow-xl">
                  <h3 className="font-black text-gray-800 mb-6 flex items-center gap-3 text-lg">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#11CCEF] to-[#E51791] rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    Price Summary
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-600 font-medium">Certificate Base Price:</span>
                      <span className="font-bold text-lg">£{Number(pricing.base_price).toFixed(2)}</span>
                    </div>
                    {courierType && (
                      <div className="flex justify-between items-center py-2 border-t border-gray-100">
                        <span className="text-gray-600 font-medium">Courier Charges:</span>
                        <span className="font-bold text-lg">
                          £
                          {courierType === 'normal'
                            ? Number(pricing.normal_courier_price).toFixed(2)
                            : Number(pricing.special_courier_price).toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="border-t-2 border-dashed border-gray-200 pt-4 mt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xl font-black text-gray-800">Total Amount:</span>
                        <span className="text-4xl font-black bg-gradient-to-r from-[#11CCEF] to-[#E51791] bg-clip-text text-transparent">
                          £{totalPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-5 pt-6">
              <button
                type="button"
                onClick={() => router.push(`/dashboard/student/cpd/${courseId}`)}
                className="flex-1 py-5 px-6 border-2 border-gray-300 rounded-2xl font-bold text-gray-600 hover:bg-gray-50 hover:border-[#E51791]/50 hover:text-[#E51791] transition-all duration-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={`flex-1 py-5 px-6 rounded-2xl font-black text-lg transition-all duration-300 transform hover:scale-[1.02] ${
                  submitting
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-[#11CCEF] to-[#E51791] text-white shadow-2xl shadow-[#E51791]/40 hover:shadow-3xl hover:shadow-[#E51791]/50 hover:from-[#E51791] hover:to-[#11CCEF]'
                }`}
              >
                {submitting ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-6 w-6 mr-3" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Processing...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-3">
                    Proceed to Payment
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}