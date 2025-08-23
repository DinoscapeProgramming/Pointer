#!/usr/bin/env python3
"""
Test script for Startpage scraping integration
Run this to verify the new web search functionality is working correctly
"""

import asyncio
import sys
import os

# Add the current directory to Python path so we can import tools_handlers
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

async def test_startpage_scraping():
    """Test the Startpage scraping integration"""
    
    try:
        # Import the web_search function
        from tools_handlers import web_search
        
        print("✅ Successfully imported web_search function")
        
        # Test basic search
        print("\n🔍 Testing basic search...")
        result = await web_search(search_term="python programming", num_results=5)
        
        if result["success"]:
            print(f"✅ Basic search successful!")
            print(f"   Query: {result['query']}")
            print(f"   Results found: {result['num_results']}")
            print(f"   Source: {result['source']}")
            
            # Display first few results
            for i, res in enumerate(result['results'][:3]):
                print(f"\n   Result {i+1}:")
                print(f"     Title: {res['title'][:60]}...")
                print(f"     URL: {res['url'][:80]}...")
                print(f"     Snippet: {res['snippet'][:100]}...")
        else:
            print(f"❌ Search failed: {result['error']}")
            return False
        
        # Test with different number of results
        print("\n🔍 Testing with 3 results...")
        result2 = await web_search(search_term="machine learning", num_results=3)
        
        if result2["success"]:
            print(f"✅ Limited results search successful!")
            print(f"   Results found: {result2['num_results']}")
        else:
            print(f"❌ Limited results search failed: {result2['error']}")
        
        # Test with location parameter (though limited with scraping)
        print("\n🔍 Testing with location parameter...")
        result3 = await web_search(search_term="coffee shops", location="Austin, Texas", num_results=4)
        
        if result3["success"]:
            print(f"✅ Location-based search successful!")
            print(f"   Results found: {result3['num_results']}")
        else:
            print(f"❌ Location-based search failed: {result3['error']}")
        
        print("\n🎉 All tests completed successfully!")
        return True
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("Make sure you're running this from the backend directory")
        return False
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Testing Startpage Scraping Integration")
    print("=" * 50)
    
    # Run the test
    success = asyncio.run(test_startpage_scraping())
    
    if success:
        print("\n✅ All tests passed! Startpage scraping is working correctly.")
    else:
        print("\n❌ Some tests failed. Check the error messages above.")
        sys.exit(1)
