'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiService } from '@/app/services/api';
import { showSweetAlert } from '@/app/components/SweetAlert';
import { showToast } from '@/app/components/Toast';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe('pk_test_51Sd4t6KE3MCnAkQIQeGftz0GkA0CmX80WLyXSfOZU2Kv4XcTx6UoKKyIe7O0yACAp7GNP15dgpWlToCtVwmej07500zWhrjhqm');

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
      color: '#32325d',
      fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
      fontSmoothing: 'antialiased',
      fontSize: '16px',
      '::placeholder': {
        color: '#aab7c4',
      },
    },
    invalid: {
      color: '#fa755a',
      iconColor: '#fa755a',
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
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed');
      showToast('error', err.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Card Details
        </label>
        <div className="border border-gray-300 rounded-lg p-4 bg-white">
          <CardElement options={CARD_ELEMENT_OPTIONS} />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="flex justify-between items-center text-lg font-semibold">
          <span>Total Amount:</span>
          <span className="text-blue-600">£{totalPrice.toFixed(2)}</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={!stripe || processing}
        className={`w-full py-3 px-6 rounded-lg font-medium transition-colors ${
          !stripe || processing
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {processing ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
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
          `Pay £${totalPrice.toFixed(2)}`
        )}
      </button>

      <p className="text-xs text-gray-500 text-center">
        Your payment is secured by Stripe. We never store your card details.
      </p>
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

  // Payment state
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [claimId, setClaimId] = useState<number | null>(null);
  const [totalPrice, setTotalPrice] = useState(0);

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
        if (courseResponse.success) {
          setCourse(courseResponse.course);
        }

        // Fetch certificates catalog
        const certResponse = await apiService.getCertificateCatalog();
        if (certResponse.success) {
          setCertificates(certResponse.certificates);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        showToast('Failed to load form data', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [courseId, router]);

  // Load level courses when level is selected
  useEffect(() => {
    const loadLevelCourses = async () => {
      if (certificateType === 'level' && cpdCourseLevel) {
        try {
          const response = await apiService.getLevelCourses(cpdCourseLevel);
          if (response.success) {
            setLevelCourses(response.courses);
          }
        } catch (error) {
          console.error('Error fetching level courses:', error);
        }
      }
    };

    loadLevelCourses();
  }, [cpdCourseLevel, certificateType]);

  // Calculate pricing when delivery options change
  useEffect(() => {
    const calculatePricing = async () => {
      if (!deliveryOption || !cpdCourseLevel) return;

      try {
        // For "Certificate" option, use "General" pricing
        // For Level options, use the selected level
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
      console.error('Error submitting claim:', error);
      
      // Check if it's a duplicate claim error
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (showPaymentForm && claimId) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="mb-6">
              <button
                onClick={() => setShowPaymentForm(false)}
                className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
              >
                ← Back to Form
              </button>
            </div>

            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Complete Payment
            </h1>
            <p className="text-gray-600 mb-8">
              Complete your payment to receive your certificate
            </p>

            <Elements stripe={stripePromise}>
              <CheckoutForm
                claimId={claimId}
                totalPrice={totalPrice}
                onSuccess={handlePaymentSuccess}
              />
            </Elements>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="mb-6">
            <button
              onClick={() => router.push(`/dashboard/student/cpd/${courseId}`)}
              className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
            >
              ← Back to Course
            </button>
          </div>

          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Claim Certificate
          </h1>
          <p className="text-gray-600 mb-8">
            {course?.title}
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="As displayed on certificate"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your phone number"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your email"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date of Birth <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Government ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Government Issued Photo ID <span className="text-red-500">*</span>
              </label>
              <input
                type="file"
                onChange={handleFileChange}
                accept=".jpg,.jpeg,.png,.pdf"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Only JPG, JPEG, PNG, or PDF files. Max size: 5MB
              </p>
              {photoId && (
                <p className="text-sm text-green-600 mt-2">
                  ✓ Selected: {photoId.name}
                </p>
              )}
            </div>

            {/* Postal Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Postal Address <span className="text-red-500">*</span>
              </label>
              <textarea
                value={postalAddress}
                onChange={(e) => setPostalAddress(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your postal address"
                required
              />
            </div>

            {/* CPD Course Level or Certificate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CPD Course Level / Certificate <span className="text-red-500">*</span>
              </label>
              <select
                value={cpdCourseLevel}
                onChange={(e) => {
                  const value = e.target.value;
                  setCpdCourseLevel(value);
                  setSelectedCertificate('');
                  setSelectedCourseName('');
                  
                  // Automatically set certificate type based on selection
                  if (value === 'Certificate') {
                    setCertificateType('certificate');
                  } else if (value) {
                    setCertificateType('level');
                  } else {
                    setCertificateType('');
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select Option</option>
                <option value="Certificate">Certificate (All Levels)</option>
                <optgroup label="Level-Based Courses">
                  {['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5', 'Level 6', 'Level 7'].map(
                    (level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    )
                  )}
                </optgroup>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {cpdCourseLevel === 'Certificate' 
                  ? 'Choose from all available certificates' 
                  : cpdCourseLevel 
                  ? `Choose from ${cpdCourseLevel} specific courses`
                  : 'Select Certificate or a specific Level'
                }
              </p>
            </div>

            {/* Certificate Selection */}
            {certificateType === 'certificate' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Certificate <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedCertificate}
                  onChange={(e) => setSelectedCertificate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Choose Certificate</option>
                  {certificates.map((cert) => (
                    <option key={cert.id} value={cert.certificate_name}>
                      {cert.certificate_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Level Course Selection */}
            {certificateType === 'level' && levelCourses.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Course <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedCourseName}
                  onChange={(e) => setSelectedCourseName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Choose Course</option>
                  {levelCourses.map((course) => (
                    <option key={course.id} value={course.course_name}>
                      {course.course_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Delivery Option */}
            {(certificateType === 'certificate' || certificateType === 'level') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Delivery Option <span className="text-red-500">*</span>
                </label>
                <select
                  value={deliveryOption}
                  onChange={(e) => setDeliveryOption(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select Delivery Type</option>
                  <option value="Hardcopy+PDF">CPD Hardcopy+PDF</option>
                  <option value="Hardcopy">CPD Hardcopy</option>
                  <option value="Softcopy">CPD Softcopy (PDF Format)</option>
                </select>
              </div>
            )}

            {/* Courier Selection */}
            {(deliveryOption === 'Hardcopy+PDF' || deliveryOption === 'Hardcopy') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Courier Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={courierType}
                  onChange={(e) => setCourierType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select Courier</option>
                  <option value="normal">
                    Normal Courier (£{Number(pricing?.normal_courier_price || 0).toFixed(2)})
                  </option>
                  <option value="special">
                    Special Courier - International (£{Number(pricing?.special_courier_price || 0).toFixed(2)})
                  </option>
                </select>
              </div>
            )}

            {/* Price Summary */}
            {pricing && deliveryOption && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-800 mb-4">Price Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Certificate Base Price:</span>
                    <span className="font-medium">£{Number(pricing.base_price).toFixed(2)}</span>
                  </div>
                  {courierType && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Courier Charges:</span>
                      <span className="font-medium">
                        £
                        {courierType === 'normal'
                          ? Number(pricing.normal_courier_price).toFixed(2)
                          : Number(pricing.special_courier_price).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="border-t border-blue-300 pt-2 mt-2">
                    <div className="flex justify-between text-lg font-bold">
                      <span className="text-gray-800">Total:</span>
                      <span className="text-blue-600">£{totalPrice.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => router.push(`/dashboard/student/cpd/${courseId}`)}
                className="flex-1 py-3 px-6 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={`flex-1 py-3 px-6 rounded-lg font-medium transition-colors ${
                  submitting
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {submitting ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
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
                    Submitting...
                  </span>
                ) : (
                  'Submit & Proceed to Payment'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

