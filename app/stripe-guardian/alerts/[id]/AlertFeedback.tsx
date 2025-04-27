'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
// import { logger } from '@/lib/logger'; // Assuming logger exists

interface AlertFeedbackProps {
  alertId: string | number; // Alert ID can be number or UUID string
}

interface FeedbackCounts {
  false_positive: number;
  legit: number;
}

export function AlertFeedback({ alertId }: AlertFeedbackProps) {
  const [feedbackState, setFeedbackState] = useState<'idle' | 'submitting' | 'submitted'>('idle');
  const [selectedVerdict, setSelectedVerdict] = useState<'false_positive' | 'legit' | null>(null);
  const [comment, setComment] = useState('');
  const [showComment, setShowComment] = useState(false);
  const [feedbackCounts, setFeedbackCounts] = useState<FeedbackCounts>({
    false_positive: 0,
    legit: 0,
  });
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);
  const [userVote, setUserVote] = useState<'false_positive' | 'legit' | null>(null); // Track the logged-in user's specific vote

  // Fetch initial counts and user's vote (if any)
  const fetchFeedbackData = useCallback(async () => {
    setIsLoadingCounts(true);
    try {
      // Fetch aggregate counts
      const countsRes = await fetch(`/api/guardian/alerts/feedback?alertId=${alertId}`);
      if (!countsRes.ok) throw new Error('Failed to fetch feedback counts');
      const countsData: FeedbackCounts = await countsRes.json();
      setFeedbackCounts(countsData);

      // TODO: Fetch the current user's specific vote if needed to pre-fill state
      // This might require another API endpoint or modifying the GET response
      // For now, we rely on local state after submission.

      // logger.info('Fetched feedback counts', { alertId, counts: countsData });
      console.log('Fetched feedback counts', { alertId, counts: countsData });
    } catch (error: any) {
      // logger.error('Error fetching feedback data', { alertId, error: error.message });
      console.error('Error fetching feedback data', { alertId, error: error.message });
      toast.error('Could not load feedback counts.');
    } finally {
      setIsLoadingCounts(false);
    }
  }, [alertId]);

  useEffect(() => {
    fetchFeedbackData();
  }, [fetchFeedbackData]);

  const handleSubmit = async (verdict: 'false_positive' | 'legit') => {
    setFeedbackState('submitting');
    setSelectedVerdict(verdict);
    let feedbackComment = verdict === 'false_positive' ? comment : undefined;

    // logger.info('Submitting feedback', { alertId, verdict, hasComment: !!feedbackComment });
    console.log('Submitting feedback', { alertId, verdict, hasComment: !!feedbackComment });

    try {
      const response = await fetch('/api/guardian/alerts/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, verdict, comment: feedbackComment }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit feedback');
      }

      // logger.info('Feedback submitted successfully', { alertId, verdict });
      console.log('Feedback submitted successfully', { alertId, verdict });
      toast.success('Thank you for your feedback!');
      setFeedbackState('submitted');
      setUserVote(verdict); // Update user's current vote locally
      // Refresh counts after submission
      fetchFeedbackData();
      setShowComment(false); // Hide comment box after successful submission
    } catch (error: any) {
      // logger.error('Error submitting feedback', { alertId, verdict, error: error.message });
      console.error('Error submitting feedback', { alertId, verdict, error: error.message });
      toast.error(`Failed to submit feedback: ${error.message}`);
      setFeedbackState('idle'); // Reset state on error
      setSelectedVerdict(null);
    }
  };

  // Handle clicking a verdict button
  const handleVoteClick = (verdict: 'false_positive' | 'legit') => {
    if (feedbackState === 'submitting') return;

    // If clicking the same verdict again (effectively an undo/change mind before submit)
    if (selectedVerdict === verdict && feedbackState !== 'submitted') {
      setSelectedVerdict(null);
      setShowComment(false);
      setComment('');
      return;
    }

    // If changing vote or making initial vote
    setSelectedVerdict(verdict);
    if (verdict === 'false_positive') {
      setShowComment(true);
    } else {
      setShowComment(false);
      setComment(''); // Clear comment if switching to legit
      // Submit immediately if choosing legit
      handleSubmit(verdict);
    }
  };

  // Handle submitting the comment for false positive
  const handleFalsePositiveSubmit = () => {
    if (selectedVerdict === 'false_positive') {
      handleSubmit('false_positive');
    }
  };

  // Allow user to change their mind after submitting
  const handleUndo = () => {
    setFeedbackState('idle');
    setSelectedVerdict(null);
    setUserVote(null); // Clear local memory of user vote
    setShowComment(false);
    setComment('');
    // Note: This doesn't delete the feedback from the DB, just resets UI state
    // To truly undo, a DELETE API call would be needed.
    // Current behavior: allows user to re-vote which updates their previous vote.
  };

  return (
    <div className="mt-6">
      <h3 className="text-md font-semibold text-slate-700 mb-3">Was this alert correct?</h3>

      {feedbackState === 'submitted' ? (
        <div className="flex items-center space-x-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <span className="text-green-700">Thank you for your feedback!</span>
          <Button variant="link" onClick={handleUndo} className="text-sm p-0 h-auto">
            (Change my vote)
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <Button
              variant={selectedVerdict === 'false_positive' ? 'destructive' : 'ghost'}
              onClick={() => handleVoteClick('false_positive')}
              disabled={feedbackState === 'submitting'}
              size="sm"
            >
              {feedbackState === 'submitting' && selectedVerdict === 'false_positive' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                '🚫'
              )}
              False Positive
            </Button>
            <Button
              variant={selectedVerdict === 'legit' ? 'success' : 'ghost'} // Need a 'success' variant or use default
              onClick={() => handleVoteClick('legit')}
              disabled={feedbackState === 'submitting'}
              size="sm"
            >
              {feedbackState === 'submitting' && selectedVerdict === 'legit' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                '✅'
              )}
              Legit
            </Button>
          </div>

          {showComment && selectedVerdict === 'false_positive' && (
            <div className="space-y-2">
              <Textarea
                placeholder="Optional: Why was this a false positive? (e.g., known customer activity)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                disabled={feedbackState === 'submitting'}
              />
              <Button
                onClick={handleFalsePositiveSubmit}
                disabled={feedbackState === 'submitting'}
                size="sm"
              >
                {feedbackState === 'submitting' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Submit False Positive Feedback
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Display Counts */}
      <div className="mt-4 text-sm text-slate-500">
        {isLoadingCounts ? (
          <span className="flex items-center">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Loading feedback counts...
          </span>
        ) : (
          <span>
            Current Feedback: {feedbackCounts.false_positive} False Positive /{' '}
            {feedbackCounts.legit} Legit
          </span>
        )}
      </div>
    </div>
  );
}
