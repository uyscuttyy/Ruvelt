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

function unixSeconds(
  date: string,
  hour: string,
  minute: string,
  period: string,
): bigint {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date);
  if (!match || !hour || !minute || !period) return 0n;
  const [, day, month, year] = match;
  const hours = (Number(hour) % 12) + (period === 'PM' ? 12 : 0);
  const minutes = Number(minute);
  if (minutes > 59) return 0n;
  const timestamp = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    hours,
    minutes,
  );
  if (
    timestamp.getFullYear() !== Number(year) ||
    timestamp.getMonth() !== Number(month) - 1 ||
    timestamp.getDate() !== Number(day) ||
    timestamp.getHours() !== hours ||
    timestamp.getMinutes() !== minutes
  )
    return 0n;
  return Number.isNaN(timestamp.getTime())
    ? 0n
    : BigInt(Math.floor(timestamp.getTime() / 1000));
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
  const [applicationDate, setApplicationDate] = useState('');
  const [applicationHour, setApplicationHour] = useState('');
  const [applicationMinute, setApplicationMinute] = useState('00');
  const [applicationPeriod, setApplicationPeriod] = useState('PM');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryHour, setDeliveryHour] = useState('');
  const [deliveryMinute, setDeliveryMinute] = useState('00');
  const [deliveryPeriod, setDeliveryPeriod] = useState('AM');
  const [reviewHours, setReviewHours] = useState('24');
  const [validationError, setValidationError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError('');

    const application = unixSeconds(
      applicationDate,
      applicationHour,
      applicationMinute,
      applicationPeriod,
    );
    const delivery = unixSeconds(
      deliveryDate,
      deliveryHour,
      deliveryMinute,
      deliveryPeriod,
    );
    const now = BigInt(Math.floor(Date.now() / 1000));
    const review = BigInt(reviewHours) * 60n * 60n;

    if (!detailsRef.trim())
      return setValidationError('Describe the work or add a reference.');
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
          <span>What needs to be done</span>
          <textarea
            required
            rows={4}
            placeholder="Describe the task, outcome, or attach an https:// or ipfs:// reference."
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
          <span>
            Applications close <small>(dd/mm/yyyy)</small>
          </span>
          <div className="date-fields">
            <input
              required
              inputMode="numeric"
              placeholder="dd/mm/yyyy"
              value={applicationDate}
              onChange={(event) => setApplicationDate(event.target.value)}
            />
            <select
              required
              value={applicationHour}
              onChange={(event) => setApplicationHour(event.target.value)}
            >
              <option value="">Hour</option>
              {Array.from({ length: 12 }, (_, index) => (
                <option key={index + 1}>
                  {String(index + 1).padStart(2, '0')}
                </option>
              ))}
            </select>
            <select
              value={applicationMinute}
              onChange={(event) => setApplicationMinute(event.target.value)}
            >
              {['00', '15', '30', '45'].map((minute) => (
                <option key={minute}>{minute}</option>
              ))}
            </select>
            <select
              value={applicationPeriod}
              onChange={(event) => setApplicationPeriod(event.target.value)}
            >
              <option>AM</option>
              <option>PM</option>
            </select>
          </div>
        </label>
        <label className="field">
          <span>
            Delivery due <small>(dd/mm/yyyy)</small>
          </span>
          <div className="date-fields">
            <input
              required
              inputMode="numeric"
              placeholder="dd/mm/yyyy"
              value={deliveryDate}
              onChange={(event) => setDeliveryDate(event.target.value)}
            />
            <select
              required
              value={deliveryHour}
              onChange={(event) => setDeliveryHour(event.target.value)}
            >
              <option value="">Hour</option>
              {Array.from({ length: 12 }, (_, index) => (
                <option key={index + 1}>
                  {String(index + 1).padStart(2, '0')}
                </option>
              ))}
            </select>
            <select
              value={deliveryMinute}
              onChange={(event) => setDeliveryMinute(event.target.value)}
            >
              {['00', '15', '30', '45'].map((minute) => (
                <option key={minute}>{minute}</option>
              ))}
            </select>
            <select
              value={deliveryPeriod}
              onChange={(event) => setDeliveryPeriod(event.target.value)}
            >
              <option>AM</option>
              <option>PM</option>
            </select>
          </div>
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
