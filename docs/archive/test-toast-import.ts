// Test file to verify react-hot-toast module resolution
import toast from 'react-hot-toast'

// Test basic toast functionality
export function testToast() {
    toast.success('React-hot-toast is working correctly!')
    toast.error('This is an error test')

    console.log('✅ react-hot-toast module resolution successful')

    return {
        success: true,
        moduleResolved: true,
        message: 'react-hot-toast module can be imported successfully'
    }
}

// Export for testing
export default testToast