import { useMemo, useState } from 'react';
import { JobDiscovery } from './JobDiscovery';
import type { JobView } from './JobTypes';

type Props = { jobs: JobView[]; loading: boolean; connectedAccount?: string };

export function JobsPage(props: Props) {
  const [sort, setSort] = useState<'newest' | 'application' | 'delivery'>(
    'newest',
  );
  const jobs = useMemo(
    () =>
      [...props.jobs].sort((a, b) => {
        if (sort === 'application')
          return Number(a.applicationDeadline - b.applicationDeadline);
        if (sort === 'delivery')
          return Number(a.deliveryDeadline - b.deliveryDeadline);
        return Number(b.createdAt - a.createdAt);
      }),
    [props.jobs, sort],
  );
  return (
    <main className="jobs-page">
      <nav className="jobs-page-nav" aria-label="Jobs navigation">
        <a className="landing-brand" href="/">
          Ruvelt<span>.</span>
        </a>
        <a href="/app">Marketplace</a>
      </nav>
      <header className="jobs-page-header">
        <p className="landing-kicker">All opportunities</p>
        <div className="jobs-page-hero-grid">
          <h1>Find your next job</h1>
          <select
            aria-label="Sort jobs"
            value={sort}
            onChange={(event) => setSort(event.target.value as typeof sort)}
          >
            <option value="newest">Sort by: Newest</option>
            <option value="application">Sort by: Application closes</option>
            <option value="delivery">Sort by: Delivery date</option>
          </select>
          <p className="jobs-page-tagline">
            The complete marketplace for Agent work on BOT Chain.
          </p>
          <a className="jobs-page-funded-link" href="/app#fund-a-job">
            Post a funded job →
          </a>
        </div>
      </header>
      <section className="jobs-page-market" aria-labelledby="all-jobs-title">
        <div className="jobs-page-toolbar">
          <div>
            <p className="landing-kicker">Live ecosystem</p>
            <h2 id="all-jobs-title">All jobs</h2>
          </div>
        </div>
        <JobDiscovery
          jobs={jobs}
          loading={props.loading}
          connectedAccount={props.connectedAccount}
          preserveOrder
        />
        <a
          className="view-all-jobs jobs-page-create-link"
          href="/app#fund-a-job"
        >
          Create a job →
        </a>
      </section>
    </main>
  );
}
