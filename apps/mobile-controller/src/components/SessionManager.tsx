import { useState } from 'react';
import { useSession } from '../contexts/SessionContext';
import { Modal } from './Modal';
import './SessionManager.css';

export interface SessionManagerProps {
  className?: string;
  compact?: boolean;
}

export function SessionManager({ className, compact = false }: SessionManagerProps) {
  const { state, updateNickname, resetSession, clearError } = useSession();
  const [isEditing, setIsEditing] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showFullModal, setShowFullModal] = useState(false);

  const handleEditStart = () => {
    if (!state.session) return;
    setNewNickname(state.session.nickname);
    setIsEditing(true);
    clearError();
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setNewNickname('');
    clearError();
  };

  const handleEditSave = () => {
    const trimmedNickname = newNickname.trim();
    if (!trimmedNickname) return;

    updateNickname(trimmedNickname);
    setIsEditing(false);
    setNewNickname('');
  };

  const handleResetRequest = () => {
    setShowResetConfirm(true);
  };

  const handleResetConfirm = async () => {
    setIsResetting(true);
    try {
      resetSession();
      setShowResetConfirm(false);
    } catch (error) {
      console.error('Failed to reset session:', error);
    } finally {
      setIsResetting(false);
    }
  };

  const handleResetCancel = () => {
    setShowResetConfirm(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleEditSave();
    } else if (e.key === 'Escape') {
      handleEditCancel();
    }
  };

  if (!state.session) {
    return null;
  }

  if (compact) {
    return (
      <>
        <div className={`session-manager session-manager--compact ${className || ''}`}>
          <div className="session-manager__info" onClick={() => setShowFullModal(true)}>
            <span className="session-manager__nickname">
              {state.session.nickname}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEditStart();
              }}
              className="session-manager__edit-btn"
              title="Change nickname"
            >
              ✏️
            </button>
          </div>

          {isEditing && (
            <div className="session-manager__edit-overlay">
              <div className="session-manager__edit-form">
                <input
                  type="text"
                  value={newNickname}
                  onChange={(e) => setNewNickname(e.target.value)}
                  onKeyDown={handleKeyPress}
                  className="session-manager__edit-input"
                  placeholder="Enter nickname"
                  maxLength={20}
                  autoFocus
                />
                <div className="session-manager__edit-actions">
                  <button
                    onClick={handleEditSave}
                    disabled={!newNickname.trim()}
                    className="session-manager__save-btn"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleEditCancel}
                    className="session-manager__cancel-btn"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Full session details modal */}
        <Modal
          isOpen={showFullModal}
          onClose={() => setShowFullModal(false)}
          title="Your Session"
          className="session-modal"
        >
          <div className="session-manager__content">
            <div className="session-manager__field">
              <label className="session-manager__label">Nickname</label>
              <div className="session-manager__value-group">
                <span className="session-manager__value">
                  {state.session.nickname}
                </span>
                <button
                  onClick={() => {
                    setShowFullModal(false);
                    handleEditStart();
                  }}
                  className="session-manager__edit-btn"
                >
                  Change
                </button>
              </div>
            </div>

            <div className="session-manager__field">
              <label className="session-manager__label">Device ID</label>
              <div className="session-manager__value-group">
                <span className="session-manager__device-id">
                  {state.session.deviceId}
                </span>
              </div>
              <div className="session-manager__field-hint">
                Used for rate limiting and tracking your contributions
              </div>
            </div>

            <div className="session-manager__field">
              <label className="session-manager__label">Session Info</label>
              <div className="session-manager__session-info">
                <div className="session-manager__info-item">
                  <span className="session-manager__info-label">Created:</span>
                  <span className="session-manager__info-value">
                    {state.session.createdAt.toLocaleDateString()}
                  </span>
                </div>
                <div className="session-manager__info-item">
                  <span className="session-manager__info-label">Last Active:</span>
                  <span className="session-manager__info-value">
                    {state.session.lastActive.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>

            {state.error && (
              <div className="session-manager__error">
                {state.error}
              </div>
            )}

            <div className="session-manager__actions">
              {showResetConfirm ? (
                <div className="session-manager__reset-confirm">
                  <p>Are you sure you want to reset your session? This will:</p>
                  <ul>
                    <li>Generate a new device ID</li>
                    <li>Reset your nickname to default</li>
                    <li>Clear all session data</li>
                  </ul>
                  <div className="session-manager__confirm-actions">
                    <button
                      onClick={handleResetConfirm}
                      disabled={isResetting}
                      className="session-manager__confirm-btn"
                    >
                      {isResetting ? 'Resetting...' : 'Yes, Reset Session'}
                    </button>
                    <button
                      onClick={handleResetCancel}
                      disabled={isResetting}
                      className="session-manager__cancel-btn"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleResetRequest}
                  className="session-manager__reset-btn"
                >
                  Reset Session
                </button>
              )}
            </div>
          </div>
        </Modal>
      </>
    );
  }

  return (
    <div className={`session-manager ${className || ''}`}>
      <div className="session-manager__header">
        <h3>Your Session</h3>
      </div>

      <div className="session-manager__content">
        <div className="session-manager__field">
          <label className="session-manager__label">Nickname</label>
          {isEditing ? (
            <div className="session-manager__edit-group">
              <input
                type="text"
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                onKeyDown={handleKeyPress}
                className="session-manager__input"
                placeholder="Enter nickname"
                maxLength={20}
                autoFocus
              />
              <div className="session-manager__edit-actions">
                <button
                  onClick={handleEditSave}
                  disabled={!newNickname.trim()}
                  className="session-manager__save-btn"
                >
                  Save
                </button>
                <button
                  onClick={handleEditCancel}
                  className="session-manager__cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="session-manager__value-group">
              <span className="session-manager__value">
                {state.session.nickname}
              </span>
              <button
                onClick={handleEditStart}
                className="session-manager__edit-btn"
              >
                Change
              </button>
            </div>
          )}
        </div>

        <div className="session-manager__field">
          <label className="session-manager__label">Device ID</label>
          <div className="session-manager__value-group">
            <span className="session-manager__device-id">
              {state.session.deviceId}
            </span>
          </div>
          <div className="session-manager__field-hint">
            Used for rate limiting and tracking your contributions
          </div>
        </div>

        <div className="session-manager__field">
          <label className="session-manager__label">Session Info</label>
          <div className="session-manager__session-info">
            <div className="session-manager__info-item">
              <span className="session-manager__info-label">Created:</span>
              <span className="session-manager__info-value">
                {state.session.createdAt.toLocaleDateString()}
              </span>
            </div>
            <div className="session-manager__info-item">
              <span className="session-manager__info-label">Last Active:</span>
              <span className="session-manager__info-value">
                {state.session.lastActive.toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>

        {state.error && (
          <div className="session-manager__error">
            {state.error}
          </div>
        )}
      </div>

      <div className="session-manager__actions">
        {showResetConfirm ? (
          <div className="session-manager__reset-confirm">
            <p>Are you sure you want to reset your session? This will:</p>
            <ul>
              <li>Generate a new device ID</li>
              <li>Reset your nickname to default</li>
              <li>Clear all session data</li>
            </ul>
            <div className="session-manager__confirm-actions">
              <button
                onClick={handleResetConfirm}
                disabled={isResetting}
                className="session-manager__confirm-btn"
              >
                {isResetting ? 'Resetting...' : 'Yes, Reset Session'}
              </button>
              <button
                onClick={handleResetCancel}
                disabled={isResetting}
                className="session-manager__cancel-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleResetRequest}
            className="session-manager__reset-btn"
          >
            Reset Session
          </button>
        )}
      </div>
    </div>
  );
}