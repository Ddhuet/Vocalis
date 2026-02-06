import React from 'react';

// Static background - no animation, minimal GPU usage
const BackgroundStars: React.FC = () => {
  return (
    <div 
      className="fixed inset-0 pointer-events-none"
      style={{
        background: `
          radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%)
        `,
        opacity: 0.8
      }}
    >
      {/* Static stars using CSS - no animation */}
      <div 
        className="absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(2px 2px at 20px 30px, #eee, rgba(0,0,0,0)),
            radial-gradient(2px 2px at 40px 70px, #fff, rgba(0,0,0,0)),
            radial-gradient(2px 2px at 50px 160px, #ddd, rgba(0,0,0,0)),
            radial-gradient(2px 2px at 90px 40px, #fff, rgba(0,0,0,0)),
            radial-gradient(2px 2px at 130px 80px, #fff, rgba(0,0,0,0)),
            radial-gradient(2px 2px at 160px 120px, #ddd, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 190px 40px, #fff, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 220px 180px, #eee, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 250px 60px, #fff, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 280px 140px, #ddd, rgba(0,0,0,0)),
            radial-gradient(2px 2px at 320px 100px, #fff, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 350px 30px, #eee, rgba(0,0,0,0)),
            radial-gradient(2px 2px at 380px 170px, #fff, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 420px 80px, #ddd, rgba(0,0,0,0)),
            radial-gradient(2px 2px at 460px 150px, #fff, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 490px 50px, #eee, rgba(0,0,0,0)),
            radial-gradient(2px 2px at 520px 200px, #fff, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 560px 90px, #ddd, rgba(0,0,0,0)),
            radial-gradient(2px 2px at 590px 170px, #fff, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 620px 30px, #eee, rgba(0,0,0,0)),
            radial-gradient(2px 2px at 660px 130px, #fff, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 690px 60px, #ddd, rgba(0,0,0,0)),
            radial-gradient(2px 2px at 720px 190px, #fff, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 760px 110px, #eee, rgba(0,0,0,0)),
            radial-gradient(2px 2px at 790px 40px, #ddd, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 820px 160px, #fff, rgba(0,0,0,0)),
            radial-gradient(2px 2px at 860px 70px, #eee, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 890px 180px, #fff, rgba(0,0,0,0)),
            radial-gradient(2px 2px at 920px 20px, #ddd, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 960px 140px, #eee, rgba(0,0,0,0))
          `,
          backgroundRepeat: 'repeat',
          backgroundSize: '1000px 250px'
        }}
      />
    </div>
  );
};

export default BackgroundStars;
