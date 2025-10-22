import React from 'react';

export function useFullscreenModal(){
  const [open, setOpen] = React.useState(false);
  const openModal = () => setOpen(true);
  const closeModal = () => setOpen(false);

  const Overlay: React.FC<{title:string, children:React.ReactNode}> = ({title, children}) => {
    if(!open) return null;
    return (
      <div className="fullscreen-overlay" role="dialog" aria-modal="true">
        <div className="fullscreen-head">
          <div style={{display:'flex',gap:8, alignItems:'center'}}>
            <span className="badge">Full screen</span>
            <strong style={{color:'#fff'}}>{title}</strong>
          </div>
          <button className="btn" onClick={closeModal}>Close</button>
        </div>
        <div className="fullscreen-body">
          <div className="fullscreen-chart">
            {children}
          </div>
        </div>
      </div>
    );
  };

  return { open, openModal, closeModal, Overlay };
}
