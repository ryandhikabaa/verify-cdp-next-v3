'use client';

import dynamic from 'next/dynamic';

export const VerificationMapCard = dynamic(
  () => import('./VerificationMapCard').then((module) => module.VerificationMapCard),
  {ssr: false},
);
