import type { NextPage } from 'next';
import Navbar from '../components/navbar';
import HeroSection from '../components/landing';
import MissionSection from '@/components/mission';

const Home: NextPage = () => {
  return (
    <div className="bg-white min-h-screen">
      <Navbar />
      <HeroSection />
      <MissionSection />
      

    </div>
  );
};

export default Home;
