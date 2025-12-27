import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useConnection } from '../contexts/ConnectionContext';

interface JoinInstructionsProps {
  qrCodeSize?: number;
  className?: string;
}

export function JoinInstructions({ qrCodeSize = 200, className = '' }: JoinInstructionsProps) {
  const { state, actions } = useConnection();
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [qrError, setQrError] = useState<string>('');

  // Get the primary server URL for display
  const serverUrl = actions.getPrimaryServerUrl();
  const displayUrl = serverUrl || 'Connecting...';

  // Generate QR code when server URL changes
  useEffect(() => {
    if (!serverUrl) {
      setQrCodeDataUrl('');
      return;
    }

    const generateQRCode = async () => {
      try {
        setQrError('');
        const dataUrl = await QRCode.toDataURL(serverUrl, {
          width: qrCodeSize,
          margin: 2,
          color: {
            dark: '#333333',
            light: '#FFFFFF'
          },
          errorCorrectionLevel: 'M'
        });
        setQrCodeDataUrl(dataUrl);
      } catch (error) {
        console.error('Failed to generate QR code:', error);
        setQrError('Unable to generate QR code');
        setQrCodeDataUrl('');
      }
    };

    generateQRCode();
  }, [serverUrl, qrCodeSize]);

  // Handle case where server info is not available
  if (!state.server.url && state.server.addresses.length === 0) {
    return (
      <section 
        className={`join-instructions join-loading ${className}`}
        role="region"
        aria-label="Join instructions"
      >
        <div className="join-header">
          <h3>Join the Party</h3>
        </div>
        <div className="join-content">
          <div className="loading-message" aria-live="polite">
            <p>Setting up connection...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section 
      className={`join-instructions ${className}`}
      role="region"
      aria-label="Join instructions"
    >
      <div className="join-header">
        <h3>Join the Party</h3>
      </div>
      
      <div className="join-content">
        <div className="join-url-section">
          <p className="join-instruction">
            Open this URL on your phone:
          </p>
          <div className="url-display">
            <span 
              className="url-text"
              role="text"
              aria-label={`Primary URL: ${displayUrl}`}
            >
              {displayUrl}
            </span>
          </div>
          
          {state.server.addresses.length > 1 && (
            <div className="alternative-addresses">
              <p className="alt-instruction">Alternative addresses:</p>
              {state.server.addresses.slice(1).map((address, index) => {
                const altUrl = `http://${address}:3000`;
                return (
                  <div 
                    key={index} 
                    className="alt-url"
                    role="text"
                    aria-label={`Alternative URL ${index + 1}: ${altUrl}`}
                  >
                    {altUrl}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="join-qr-section">
          <p className="qr-instruction">
            Or scan this QR code:
          </p>
          
          {qrError ? (
            <div className="qr-error">
              <div 
                className="qr-placeholder"
                role="img"
                aria-label="QR code generation failed"
              >
                <span className="qr-error-icon" aria-hidden="true">⚠️</span>
                <p>{qrError}</p>
              </div>
            </div>
          ) : qrCodeDataUrl ? (
            <div className="qr-code-container">
              <img 
                src={qrCodeDataUrl} 
                alt={`QR code linking to ${serverUrl} for easy mobile access`}
                className="qr-code-image"
                role="img"
              />
            </div>
          ) : (
            <div className="qr-loading">
              <div 
                className="qr-placeholder"
                role="img"
                aria-label="Generating QR code"
                aria-live="polite"
              >
                <span className="qr-loading-icon" aria-hidden="true">⏳</span>
                <p>Generating QR code...</p>
              </div>
            </div>
          )}
        </div>

        <div className="join-help-section">
          <p className="help-text">
            Search for songs and add them to the queue!
          </p>
          
          {!state.isOnline && (
            <div className="connection-warning" role="alert">
              <span className="warning-icon" aria-hidden="true">⚠️</span>
              <span>Connection issues detected</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}