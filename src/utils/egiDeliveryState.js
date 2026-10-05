// Labels for a queue row's derived delivery_state. Retrying and Gave up must
// read differently at a glance: amber outline vs solid red with an icon.
export const DELIVERY_STATE_MAP = {
  pending:   { tone: 'gray',      label: 'Waiting to send' },
  sending:   { tone: 'blue',      label: 'Sending…' },
  stuck:     { tone: 'amber',     label: 'Stuck — auto-recovering' },
  retrying:  { tone: 'amber-outline', label: 'Retrying' },
  exhausted: { tone: 'red-solid', label: 'Gave up', icon: true },
  synced:    { tone: 'green',     label: 'Delivered' },
};
