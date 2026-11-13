import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageShell from '@/components/PageShell';
import Spinner from '@/components/Spinner';
import HostKeyBanner from '@/components/HostKeyBanner';
import { createMeeting, type JoinPolicy } from '@/lib/api';
import { saveHostKey } from '@/lib/storage';
import { ApiError } from '@/lib/api';

type Step = 'form' | 'creating' | 'created' | 'error';

export default function HomePage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('form');
  const [joinPolicy, setJoinPolicy] = useState<JoinPolicy>('open');
  const [passcode, setPasscode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // After creation
  const [hostKey, setHostKey] = useState('');
  const [joinLink, setJoinLink] = useState('');
  const [roomId, setRoomId] = useState('');
  const [bannerDismissed, setBannerDismissed] = useState(false);

  async function handleCreate() {
    if (joinPolicy === 'passcode' && passcode.trim().length < 4) {
      setErrorMsg('Passcode must be at least 4 characters.');
      return;
    }
    setStep('creating');
    setErrorMsg('');

    try {
      const result = await createMeeting({
        joinPolicy,
        passcode: joinPolicy === 'passcode' ? passcode.trim() : undefined,
      });

      // Save host key to sessionStorage immediately (edge case 12.2)
      saveHostKey(result.roomId, result.hostKey);

      setHostKey(result.hostKey);
      setJoinLink(result.joinLink);
      setRoomId(result.roomId);
      setStep('created');
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : 'Could not create meeting. Please try again.',
      );
      setStep('error');
    }
  }

  function handleJoinAsHost() {
    navigate(`/join/${roomId}`);
  }

  return (
    <PageShell>
      <div className="w-full max-w-sm flex flex-col gap-6">
        {/* Logo / wordmark */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--accent)' }}>
            SyncMeet
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Free video meetings. No account required.
          </p>
        </div>

        {/* Error state */}
        {step === 'error' && (
          <div
            className="rounded-lg p-3 text-sm text-center"
            style={{ background: 'rgba(224,82,82,0.1)', color: 'var(--danger)' }}
          >
            {errorMsg}
            <button
              className="block mx-auto mt-2 underline text-xs"
              style={{ color: 'var(--muted)' }}
              onClick={() => setStep('form')}
            >
              Try again
            </button>
          </div>
        )}

        {/* Form */}
        {(step === 'form' || step === 'error') && (
          <div
            className="rounded-xl p-5 flex flex-col gap-4"
            style={{ background: 'var(--surface)' }}
          >
            {/* Join policy selector */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
                Who can join?
              </label>
              <div className="flex flex-col gap-2 mt-1">
                {(
                  [
                    { value: 'open', label: 'Anyone with the link', icon: '🔓' },
                    { value: 'waiting_room', label: 'Waiting room (you admit guests)', icon: '🚪' },
                    { value: 'passcode', label: 'Passcode required', icon: '🔑' },
                  ] as { value: JoinPolicy; label: string; icon: string }[]
                ).map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors"
                    style={{
                      background:
                        joinPolicy === opt.value ? 'var(--surface-2)' : 'transparent',
                      border: `1px solid ${joinPolicy === opt.value ? 'var(--accent)' : 'var(--surface-2)'}`,
                      color: 'var(--text)',
                    }}
                  >
                    <input
                      type="radio"
                      name="joinPolicy"
                      value={opt.value}
                      checked={joinPolicy === opt.value}
                      onChange={() => {
                        setJoinPolicy(opt.value);
                        setErrorMsg('');
                      }}
                      className="accent-[var(--accent)]"
                    />
                    <span className="text-base">{opt.icon}</span>
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Passcode field */}
            {joinPolicy === 'passcode' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
                  Passcode (min 4 characters)
                </label>
                <input
                  type="text"
                  value={passcode}
                  onChange={(e) => {
                    setPasscode(e.target.value);
                    setErrorMsg('');
                  }}
                  maxLength={32}
                  placeholder="Enter a passcode"
                  className="px-3 py-2 rounded-lg text-sm"
                  style={{
                    background: 'var(--surface-2)',
                    color: 'var(--text)',
                    border: '1px solid var(--surface-2)',
                    outline: 'none',
                  }}
                />
                {errorMsg && (
                  <p className="text-xs" style={{ color: 'var(--danger)' }}>
                    {errorMsg}
                  </p>
                )}
              </div>
            )}

            <button
              onClick={handleCreate}
              className="w-full py-3 rounded-lg font-semibold text-sm"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Start meeting
            </button>
          </div>
        )}

        {/* Creating spinner */}
        {step === 'creating' && <Spinner message="Creating your meeting…" />}

        {/* Created state — host key banner + join button */}
        {step === 'created' && (
          <div className="flex flex-col gap-4 w-full max-w-lg">
            {!bannerDismissed && (
              <HostKeyBanner
                hostKey={hostKey}
                joinLink={joinLink}
                onDismiss={() => setBannerDismissed(true)}
              />
            )}
            <button
              onClick={handleJoinAsHost}
              className="w-full py-3 rounded-lg font-semibold text-sm"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Join as host →
            </button>
            {bannerDismissed && (
              <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
                Share this link with participants:{' '}
                <span style={{ color: 'var(--text)' }}>{joinLink}</span>
              </p>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}
