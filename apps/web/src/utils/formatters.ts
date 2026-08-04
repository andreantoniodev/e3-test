export function formatWhatsAppPhone(phone: string | null | undefined): string | null {
  if (!phone) {
    return null;
  }
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    if (rest.length === 9) {
      return `+55 ${ddd} ${rest.slice(0, 5)}-${rest.slice(5)}`;
    }
    if (rest.length === 8) {
      return `+55 ${ddd} ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }
  }
  return digits ? `+${digits}` : phone;
}

export function userInitials(name?: string | null, email?: string | null): string {
  const source = (name || email || '?').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function googlePhotoUrl(user: {
  photoURL?: string | null;
  providerData?: Array<{ providerId: string; photoURL?: string | null }>;
} | null): string | null {
  if (!user) {
    return null;
  }
  if (user.photoURL) {
    return user.photoURL;
  }
  const google = user.providerData?.find((item) => item.providerId === 'google.com');
  return google?.photoURL || null;
}
