import ConfessionClientPage from './confession-client';

// Required for static export with dynamic routes
export async function generateStaticParams() {
    return [{ id: 'placeholder' }];
}

export default function Page({ params }: { params: { id: string } }) {
    return <ConfessionClientPage id={params.id} />;
}
