document.addEventListener('DOMContentLoaded', function() {
    const searchResults = document.getElementById('searchResults');
    const urlParams = new URLSearchParams(window.location.search);
    const searchTerm = urlParams.get('q');

    if (searchTerm) {
        document.getElementById('searchInput').value = searchTerm;
        fetchSearchResults(searchTerm);
    } else {
        searchResults.innerHTML = '<p>No search term provided. Try searching for products like "scissors", "rulers", or "buckles".</p>';
    }
});

function fetchSearchResults(searchTerm) {
    // In a real application, this would be an API call to your backend
    // For now, we'll use a more comprehensive list of products from your website
    const products = [
        { name: "Daji Professional Fabric Shears", price: "$43.5", url: "../products/daji_1.html", category: "Tools" },
        { name: "Kearing Metal Edge Cutting Ruler", price: "$53.50", url: "../products/kearing_kpr6006_s.html", category: "Tools" },
        { name: "Kearing Hip Cuver Metal Ruler", price: "$56.50", url: "../products/kearing_curve_metal_ruler.html", category: "Tools" },
        { name: "Black Bull Buckle", price: "$12.00", url: "../products/black_metal_bull_buckle.html", category: "Notions ✚ Trims" }
    ];

    const filteredProducts = products.filter(product => 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.price.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    displayResults(filteredProducts, searchTerm);
}

function displayResults(results, searchTerm) {
    const searchResults = document.getElementById('searchResults');
    searchResults.innerHTML = '';
    
    if (results.length === 0) {
        searchResults.innerHTML = `<p>No results found for "${searchTerm}". Try searching for products like "scissors", "rulers", or "buckles".</p>`;
    } else {
        searchResults.innerHTML = `<p>Found ${results.length} result${results.length > 1 ? 's' : ''} for "${searchTerm}":</p>`;
        const ul = document.createElement('ul');
        results.forEach(product => {
            const li = document.createElement('li');
            li.innerHTML = `
                <a href="${product.url}" class="search-result-item">
                    <h3>${product.name}</h3>
                    <p class="price">${product.price}</p>
                    <p class="category">${product.category}</p>
                </a>
            `;
            ul.appendChild(li);
        });
        searchResults.appendChild(ul);
    }
}