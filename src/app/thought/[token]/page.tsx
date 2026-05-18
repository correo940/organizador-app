import ThoughtClientPage from './thought-client';

// Required for static export with dynamic routes
export async function generateStaticParams() {
    return [{ token: 'placeholder' }];
}

export default function Page() {
    return <ThoughtClientPage />;
}
