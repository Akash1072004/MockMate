import { supabase, isSupabaseConfigured } from '../lib/supabase';

/**
 * Service for creating and retrieving peer interview ratings and reviews.
 * Adheres strictly to Supabase schema with unique constraint on interview_id.
 */

// Submit a new review for a completed peer interview
export async function submitReview({
  interviewId,
  candidateId,
  interviewerId,
  rating,
  reviewText,
}) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase client is not configured.');
  }

  if (!interviewId) throw new Error('Interview ID is required');
  if (!candidateId) throw new Error('Candidate ID is required');
  if (!interviewerId) throw new Error('Interviewer ID is required');

  const numericRating = Number(rating);
  if (!numericRating || numericRating < 1 || numericRating > 5) {
    throw new Error('Rating must be an integer between 1 and 5 stars.');
  }

  // 1. Check for existing review to enforce idempotency
  const existing = await getReviewByInterviewId(interviewId);
  if (existing) {
    throw new Error('A review has already been submitted for this interview session.');
  }

  // 2. Insert the review into public.reviews
  const { data, error } = await supabase
    .from('reviews')
    .insert({
      interview_id: interviewId,
      candidate_id: candidateId,
      interviewer_id: interviewerId,
      rating: numericRating,
      review_text: (reviewText || '').trim(),
    })
    .select()
    .single();

  if (error) {
    console.error('[reviewService] submitReview error:', error);
    if (error.code === '23505') {
      throw new Error('A review for this interview already exists.');
    }
    throw new Error(error.message || 'Failed to submit review.');
  }

  return data;
}

// Fetch review for a specific interview
export async function getReviewByInterviewId(interviewId) {
  if (!isSupabaseConfigured || !supabase || !interviewId) return null;

  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('interview_id', interviewId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.warn('[reviewService] getReviewByInterviewId error:', error.message);
      return null;
    }

    return data || null;
  } catch (err) {
    console.warn('[reviewService] getReviewByInterviewId exception:', err);
    return null;
  }
}

// Fetch all reviews for an interviewer
export async function getInterviewerReviews(interviewerId) {
  if (!isSupabaseConfigured || !supabase || !interviewerId) return [];

  try {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        id,
        interview_id,
        candidate_id,
        interviewer_id,
        rating,
        review_text,
        created_at,
        candidate:candidate_id (
          id,
          full_name
        )
      `)
      .eq('interviewer_id', interviewerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[reviewService] getInterviewerReviews error:', error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.warn('[reviewService] getInterviewerReviews exception:', err);
    return [];
  }
}

// Calculate average rating and total review count
export async function getInterviewerRatingSummary(interviewerId) {
  const reviews = await getInterviewerReviews(interviewerId);
  if (!reviews || reviews.length === 0) {
    return { averageRating: null, totalReviews: 0 };
  }

  const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
  const avg = (sum / reviews.length).toFixed(1);

  return {
    averageRating: avg,
    totalReviews: reviews.length,
  };
}
