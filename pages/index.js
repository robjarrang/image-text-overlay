import React, { useState, useCallback } from 'react';

export default function Home() {
  const [formData, setFormData] = useState({
    text: '',
    imageUrl: '',
    fontSize: '40',
    fontColor: 'white',
    x: '10',
    y: '50',
  });
  const [generatedUrl, setGeneratedUrl] = useState('');

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const generateUrl = useCallback((e) => {
    e.preventDefault();
    const baseUrl = window.location.origin;
    const queryParams = new URLSearchParams(formData).toString();
    const url = `${baseUrl}/api/overlay?${queryParams}`;
    setGeneratedUrl(url);
  }, [formData]);

  return (
    <div className="container">
      <h1>Image Text Overlay URL Generator</h1>
      <p>The output image dimensions will automatically match the source image.</p>
      <form onSubmit={generateUrl}>
        <div>
          <label htmlFor="text">Text:</label>
          <input
            type="text"
            id="text"
            name="text"
            value={formData.text}
            onChange={handleInputChange}
            required
          />
        </div>
        <div>
          <label htmlFor="imageUrl">Image URL:</label>
          <input
            type="url"
            id="imageUrl"
            name="imageUrl"
            value={formData.imageUrl}
            onChange={handleInputChange}
            required
          />
        </div>
        <div>
          <label htmlFor="fontSize">Font Size:</label>
          <input
            type="number"
            id="fontSize"
            name="fontSize"
            value={formData.fontSize}
            onChange={handleInputChange}
          />
        </div>
        <div>
          <label htmlFor="fontColor">Font Color:</label>
          <input
            type="text"
            id="fontColor"
            name="fontColor"
            value={formData.fontColor}
            onChange={handleInputChange}
          />
        </div>
        <div>
          <label htmlFor="x">X Position:</label>
          <input
            type="number"
            id="x"
            name="x"
            value={formData.x}
            onChange={handleInputChange}
          />
        </div>
        <div>
          <label htmlFor="y">Y Position:</label>
          <input
            type="number"
            id="y"
            name="y"
            value={formData.y}
            onChange={handleInputChange}
          />
        </div>
        <button type="submit">Generate URL</button>
      </form>
      {generatedUrl && (
        <div className="result">
          <h2>Generated URL:</h2>
          <p>{generatedUrl}</p>
          <img src={generatedUrl} alt="Generated overlay" style={{maxWidth: '100%', height: 'auto'}} />
        </div>
      )}
    </div>
  );
}