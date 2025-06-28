import type { NextPage } from 'next';
import Navbar from '../components/navbar';
import HeroSection from '../components/landing';

const Home: NextPage = () => {
  return (
    <div className="bg-white min-h-screen">
      <Navbar />
      <HeroSection />
    </div>
  );
};

export default Home;
