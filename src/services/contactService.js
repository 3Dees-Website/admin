import { BASE_URL } from './apiClient';

export const contactService = {
  async submit({ fullName, email, phone, orgName, subject, message }) {
    const res = await fetch(`${BASE_URL}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email, phone, orgName, subject, message }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw json;
    return json;
  },
};
