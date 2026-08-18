import { useState, type FormEvent } from 'react';

export type CreateJobInput = {
  detailsRef: string;
  budget: string;
  applicationDeadline: bigint;
  deliveryDeadline: bigint;
  reviewPeriod: bigint;
};

type Props = {
  connected: boolean;
  pending: boolean;
  transactionHash?: string;
  explorerUrl: string;
  error?: string;
  onSubmit(input: CreateJobInput): Promise<void>;
};

function unixSeconds(value: string): bigint {
  return BigInt(Math.floor(new Date(value).getTime() / 1000));
}

export function CreateJobForm({
  connected,
  pending,
  transactionHash,
  explorerUrl,
  error,
  onSubmit,
}: Props) {
  const [detailsRef, setDetailsRef] = useState('');
  const [budget, setBudget] = useState('');
  const [applicationDeadline, setApplicationDeadline] = useState('');
  const [deliveryDeadline, setDeliveryDeadline] = useState('');
  const [reviewHours, setReviewHours] = useState('24');
  const [validationError, setValidationError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError('');

    const application = unixSeconds(applicationDeadline);
    const delivery = unixSeconds(deliveryDeadline);
    const now = BigInt(Math.floor(Date.now() / 1000));
    const review = BigInt(reviewHours) * 60n * 60n;

    if (!detailsRef.trim())
      return setValidationError('Enter a public job details reference.');
    if (!budget || Number(budget) <= 0)
      return setValidationError('Budget must be greater than zero.');
    if (application <= now)
      return setValidationError('Application deadline must be in the future.');
    if (delivery <= application)
      return setValidationError(
        'Delivery deadline must follow the application deadline.',
      );
    if (review < 3600n || review > 2592000n)
      return setValidationError(
        'Review period must be between 1 and 720 hours.',
      );

    await onSubmit({
      detailsRef: detailsRef.trim(),
      budget,
      applicationDeadline: application,
      deliveryDeadline: delivery,
      reviewPeriod: review,
    });
  }

  return (
    <section className="job-composer" aria-labelledby="create-job-title">
      <div className="composer-heading">
        <div>
          <p className="label">Creator workflow</p>
          <h2 id="create-job-title">Post a funded job</h2>
        </div>
        <span className="phase">PHASE 6</span>
      </div>
      <form onSubmit={(event) => void submit(event)}>
        <label className="field field-wide">
          <span>Job details reference</span>
          <input
            type="url"
            required
            placeholder="https://… or ipfs://…"
            value={detailsRef}
            onChange={(event) => setDetailsRef(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Budget</span>
          <div className="input-unit">
            <input
              type="number"
              required
              min="0"
              step="any"
              placeholder="0.00"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
            />
            <strong>BOT</strong>
          </div>
        </label>
        <label className="field">
          <span>Review period</span>
          <div className="input-unit">
            <input
              type="number"
              required
              min="1"
              max="720"
              step="1"
              value={reviewHours}
              onChange={(event) => setReviewHours(event.target.value)}
            />
            <strong>hours</strong>
          </div>
        </label>
        <label className="field">
          <span>Applications close</span>
          <input
            type="datetime-local"
            required
            value={applicationDeadline}
            onChange={(event) => setApplicationDeadline(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Delivery due</span>
          <input
            type="datetime-local"
            required
            value={deliveryDeadline}
            onChange={(event) => setDeliveryDeadline(event.target.value)}
          />
        </label>
        <div className="form-actions field-wide">
          <p>
            {connected
              ? 'The full budget is escrowed when the transaction confirms.'
              : 'Connect a wallet before posting.'}
          </p>
          <button type="submit" disabled={!connected || pending}>
            {pending ? 'Waiting for confirmation…' : 'Post and fund job'}
          </button>
        </div>
      </form>
      {(validationError || error) && (
        <p className="form-error" role="alert">
          {validationError || error}
        </p>
      )}
      {transactionHash && (
        <p className="form-success">
          Job transaction confirmed.{' '}
          <a
            href={`${explorerUrl}/tx/${transactionHash}`}
            target="_blank"
            rel="noreferrer"
          >
            View transaction ↗
          </a>
        </p>
      )}
    </section>
  );
}
