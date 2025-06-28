import React from 'react';

export default function MissionSection() {
  return (
    <section className="bg-white text-gray-900 py-20">
      <div className="max-w-3xl mx-auto px-4 text-center">
        <h2 className="text-4xl font-bold mb-4">Our Mission</h2>
        <p className="mb-8">
Households lose about $2,000 on wasted food every year, with 30–40% of perishables spoiling before they’re eaten. Globally, that's over 1.3 BILLION tons. At Fridger.ai, our mission is to reduce that number using AI-powered image recognition to track what's in your fridge and create nutrient dense recipes instantly. We help people cut food waste, save hundreds of dollars annually all while reducing the carbon footprint one meal at a time. </p>
        <h3 className="text-2xl font-semibold mb-2">What We Aim For</h3>
        <ul className="list-disc list-inside space-y-2 text-left md:text-center">
          <li>Instant ingredient recognition from any food photo</li>
          <li>Curated, easy-to-follow recipes tailored to your pantry</li>
          <li>Zero-waste cooking by maximizing what you already own</li>
          <li>Accessibility for cooks of all skill levels</li>
        </ul>
      </div>
    </section>
  );
}
