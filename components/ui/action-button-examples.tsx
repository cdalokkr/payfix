"use client"

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Edit, 
  Save, 
  X, 
  Trash2, 
  UserPlus, 
  Eye, 
  Settings,
  User,
  Shield,
  LogOut
} from 'lucide-react'
import { 
  ActionButton, 
  EditButton, 
  SaveButton, 
  CancelButton, 
  DeleteButton, 
  AddButton, 
  ViewButton, 
  SettingsButton 
} from './action-button'

/**
 * ActionButton Examples and Demo Component
 * 
 * This component demonstrates all available ActionButton variants and configurations,
 * showcasing the consistent styling, animations, and accessibility features.
 */
export default function ActionButtonExamples() {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})
  
  const handleAction = async (action: string) => {
    setLoadingStates(prev => ({ ...prev, [action]: true }))
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    setLoadingStates(prev => ({ ...prev, [action]: false }))
  }

  const handleSuccess = () => {
    // Example success handler
    console.log('Action completed successfully!')
  }

  const handleError = () => {
    // Example error handler  
    console.log('Action failed!')
  }

  return (
    <div className="p-8 space-y-8 max-w-4xl mx-auto">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-center">ActionButton Component Demo</h1>
        <p className="text-center text-muted-foreground">
          Comprehensive showcase of the reusable ActionButton component with all variants, 
          animations, and accessibility features.
        </p>
      </div>

      {/* Basic Variants Section */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold border-b pb-2">Basic Action Buttons</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <EditButton 
            onClick={() => handleAction('edit')}
            loading={loadingStates.edit}
            aria-label="Edit user profile"
          >
            Edit
          </EditButton>
          
          <SaveButton 
            onClick={() => handleAction('save')}
            loading={loadingStates.save}
            aria-label="Save changes"
            className="w-full"
          >
            Save
          </SaveButton>
          
          <CancelButton 
            onClick={() => handleAction('cancel')}
            loading={loadingStates.cancel}
            aria-label="Cancel operation"
            className="w-full"
          >
            Cancel
          </CancelButton>
          
          <DeleteButton 
            onClick={() => handleAction('delete')}
            loading={loadingStates.delete}
            aria-label="Delete item"
            className="w-full"
          >
            Delete
          </DeleteButton>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <AddButton 
            onClick={() => handleAction('add')}
            loading={loadingStates.add}
            aria-label="Add new item"
            className="w-full"
          >
            Add New
          </AddButton>
          
          <ViewButton 
            onClick={() => handleAction('view')}
            loading={loadingStates.view}
            aria-label="View details"
            className="w-full"
          >
            View
          </ViewButton>
          
          <SettingsButton 
            onClick={() => handleAction('settings')}
            loading={loadingStates.settings}
            aria-label="Open settings"
            className="w-full"
          >
            Settings
          </SettingsButton>
        </div>
      </section>

      {/* Icon-Only Variants Section */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold border-b pb-2">Icon-Only Variants</h2>
        
        <div className="grid grid-cols-3 md:grid-cols-7 gap-4 justify-center">
          <EditButton 
            variant="icon-only"
            onClick={() => handleAction('edit-icon')}
            loading={loadingStates['edit-icon']}
            aria-label="Edit user"
          />
          
          <SaveButton 
            variant="icon-only"
            onClick={() => handleAction('save-icon')}
            loading={loadingStates['save-icon']}
            aria-label="Save changes"
          />
          
          <CancelButton 
            variant="icon-only"
            onClick={() => handleAction('cancel-icon')}
            loading={loadingStates['cancel-icon']}
            aria-label="Cancel operation"
          />
          
          <DeleteButton 
            variant="icon-only"
            onClick={() => handleAction('delete-icon')}
            loading={loadingStates['delete-icon']}
            aria-label="Delete item"
          />
          
          <AddButton 
            variant="icon-only"
            onClick={() => handleAction('add-icon')}
            loading={loadingStates['add-icon']}
            aria-label="Add new item"
          />
          
          <ViewButton 
            variant="icon-only"
            onClick={() => handleAction('view-icon')}
            loading={loadingStates['view-icon']}
            aria-label="View details"
          />
          
          <SettingsButton 
            variant="icon-only"
            onClick={() => handleAction('settings-icon')}
            loading={loadingStates['settings-icon']}
            aria-label="Open settings"
          />
        </div>
      </section>

      {/* Size Variants Section */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold border-b pb-2">Size Variants</h2>
        
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="w-16 text-sm text-muted-foreground">Small:</span>
            <EditButton size="sm">Edit</EditButton>
            <EditButton variant="icon-only" size="sm" />
          </div>
          
          <div className="flex items-center gap-4">
            <span className="w-16 text-sm text-muted-foreground">Medium:</span>
            <EditButton size="md">Edit</EditButton>
            <EditButton variant="icon-only" size="md" />
          </div>
          
          <div className="flex items-center gap-4">
            <span className="w-16 text-sm text-muted-foreground">Large:</span>
            <EditButton size="lg">Edit</EditButton>
            <EditButton variant="icon-only" size="lg" />
          </div>
        </div>
      </section>

      {/* State Variations Section */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold border-b pb-2">State Variations</h2>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <EditButton disabled>Disabled Edit</EditButton>
            <SaveButton loading>Loading Save</SaveButton>
            <DeleteButton disabled variant="icon-only" />
            <AddButton loading variant="icon-only" />
          </div>
        </div>
      </section>

      {/* Custom Icon Section */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold border-b pb-2">Custom Icons</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <ActionButton 
            action="edit"
            icon={User}
            onClick={handleSuccess}
            aria-label="User management"
            className="w-full"
          >
            User
          </ActionButton>
          
          <ActionButton 
            action="settings"
            icon={Shield}
            onClick={handleSuccess}
            aria-label="Security settings"
            className="w-full"
          >
            Security
          </ActionButton>
          
          <ActionButton 
            action="settings"
            icon={LogOut}
            onClick={handleSuccess}
            aria-label="Sign out"
            variant="icon-only"
            size="lg"
          />
        </div>
      </section>

      {/* Real-world Usage Examples */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold border-b pb-2">Real-world Usage Examples</h2>
        
        <div className="space-y-8">
          {/* User Table Row Example */}
          <div className="p-6 border rounded-lg bg-card">
            <h3 className="text-lg font-semibold mb-4">User Management Table Row</h3>
            <div className="flex items-center justify-between p-4 border rounded bg-muted/30">
              <div className="flex-1">
                <div className="font-medium">john.doe@example.com</div>
                <div className="text-sm text-muted-foreground">John Doe • Admin</div>
              </div>
              <div className="flex gap-2">
                <EditButton 
                  size="sm" 
                  onClick={() => console.log('Edit user')}
                  aria-label="Edit John Doe"
                >
                  Edit
                </EditButton>
                <DeleteButton 
                  size="sm" 
                  onClick={() => console.log('Delete user')}
                  aria-label="Delete John Doe"
                >
                  Delete
                </DeleteButton>
              </div>
            </div>
          </div>

          {/* Form Actions Example */}
          <div className="p-6 border rounded-lg bg-card">
            <h3 className="text-lg font-semibold mb-4">Form Actions</h3>
            <div className="space-y-4">
              <div className="p-4 border rounded bg-muted/30">
                <div className="flex gap-4 justify-end">
                  <CancelButton onClick={() => console.log('Cancel form')} />
                  <SaveButton 
                    onClick={() => handleAction('form-save')}
                    loading={loadingStates['form-save']}
                  >
                    Save Changes
                  </SaveButton>
                </div>
              </div>
            </div>
          </div>

          {/* Dashboard Actions Example */}
          <div className="p-6 border rounded-lg bg-card">
            <h3 className="text-lg font-semibold mb-4">Dashboard Actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <AddButton 
                className="w-full"
                onClick={() => console.log('Add user')}
                aria-label="Add new user"
              >
                Add User
              </AddButton>
              <ViewButton 
                className="w-full"
                onClick={() => console.log('View reports')}
                aria-label="View reports"
              >
                View Reports
              </ViewButton>
              <SettingsButton 
                className="w-full"
                onClick={() => console.log('Open settings')}
                aria-label="Open settings"
              >
                Settings
              </SettingsButton>
              <EditButton 
                className="w-full"
                onClick={() => console.log('Edit profile')}
                aria-label="Edit profile"
              >
                Edit Profile
              </EditButton>
            </div>
          </div>
        </div>
      </section>

      {/* Animation Showcase */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold border-b pb-2">Animation Showcase</h2>
        <p className="text-muted-foreground">
          Hover over buttons to see the smooth micro-interactions, scale effects, and icon animations.
        </p>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <motion.div 
            className="text-center"
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.2 }}
          >
            <EditButton className="w-full" />
            <p className="text-sm text-muted-foreground mt-2">Hover Scale: 1.05x</p>
          </motion.div>
          
          <motion.div 
            className="text-center"
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.2 }}
          >
            <SaveButton className="w-full" />
            <p className="text-sm text-muted-foreground mt-2">Shadow Elevation</p>
          </motion.div>
          
          <motion.div 
            className="text-center"
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.2 }}
          >
            <DeleteButton className="w-full" />
            <p className="text-sm text-muted-foreground mt-2">Color Transitions</p>
          </motion.div>
          
          <motion.div 
            className="text-center"
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.2 }}
          >
            <AddButton className="w-full" />
            <p className="text-sm text-muted-foreground mt-2">Icon Animations</p>
          </motion.div>
        </div>
      </section>

      {/* Accessibility Features */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold border-b pb-2">Accessibility Features</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 border rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Keyboard Navigation</h3>
            <ul className="space-y-2 text-sm">
              <li>• Tab to focus buttons</li>
              <li>• Enter/Space to activate</li>
              <li>• Arrow keys for navigation</li>
              <li>• ESC to cancel operations</li>
            </ul>
          </div>
          
          <div className="p-6 border rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Screen Reader Support</h3>
            <ul className="space-y-2 text-sm">
              <li>• ARIA labels for actions</li>
              <li>• Role descriptions</li>
              <li>• State announcements</li>
              <li>• Loading status updates</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}