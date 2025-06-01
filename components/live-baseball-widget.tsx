"use client"

export function LiveBaseballWidget() {
  return (
    <div
      id="wg-api-baseball-games"
      data-host="v1.baseball.api-sports.io"
      data-key="***REMOVED***"
      data-date=""
      data-league=""
      data-season=""
      data-theme=""
      data-refresh="15"
      data-show-toolbar="true"
      data-show-errors="false"
      data-show-logos="true"
      data-modal-game="true"
      data-modal-standings="true"
      data-modal-show-logos="true"
      style={{
        maxWidth: '1000px',
        margin: '0 auto',
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 0 10px rgba(0,0,0,0.1)'
      }}
    />
  )
} 