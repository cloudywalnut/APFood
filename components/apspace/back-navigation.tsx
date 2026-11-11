'use client';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
export function BackNavigation({route}:{route:string}){
 const parts=route.split('/').filter(Boolean),base='/'+parts[0];
 if(parts.length<2||parts[1]==='home')return null;
 // These pages already include a contextual back arrow beside their content.
 if(base==='/app'&&(['cart','checkout'].includes(parts[1])||parts[1]==='orders'&&parts.length>2||parts[3]==='item'))return null;
 if(base==='/vendor'&&parts[1]==='orders'&&parts.length>2)return null;
 const map=base==='/app'&&parts[1]==='vendors'&&parts.length>2;
 return <Link className="page-back-arrow" href={map?'/app/vendors':base}><ArrowLeft size={17} aria-hidden="true"/>{map?'Back to cafeteria map':'Back to dashboard'}</Link>
}
