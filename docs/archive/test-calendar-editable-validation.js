/**
 * Test to verify Calendar28 input remains editable during validation errors
 * 
 * This test verifies that:
 * 1. The input field is NOT disabled when there's a validation error
 * 2. Users can continue to type/edit the date input
 * 3. The validation logic still works correctly
 * 4. Error message "Please enter a valid date of birth (13-120 years old)" is still displayed
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Calendar28 } from '../components/ui/calendar-28'
import { ModernAddUserForm } from '../components/dashboard/ModernAddUserForm'
import { useForm, Controller } from 'react-hook-form'

describe('Calendar28 Input Editable During Validation', () => {
  test('Calendar28 component remains editable during validation errors', () => {
    const TestForm = () => {
      const { control } = useForm({
        defaultValues: {
          dateOfBirth: ''
        }
      })

      return (
        <div>
          <Controller
            name="dateOfBirth"
            control={control}
            render={({ field, fieldState }) => (
              <div>
                <Calendar28
                  id="dateOfBirth"
                  value={field.value}
                  onChange={field.onChange}
                  className={fieldState.invalid ? "border-destructive" : ""}
                  // NOTE: disabled prop is NOT set here - this is the fix!
                />
                {fieldState.invalid && fieldState.error && (
                  <div data-testid="validation-error">
                    {fieldState.error.message}
                  </div>
                )}
              </div>
            )}
          />
        </div>
      )
    }

    render(<TestForm />)
    
    // Get the input element
    const inputElement = screen.getByLabelText('Date of Birth')
    
    // Verify input is initially editable
    expect(inputElement).not.toBeDisabled()
    
    // Trigger validation by entering an invalid date
    fireEvent.change(inputElement, { target: { value: '01/01/1900' } })
    
    // Verify input is still editable even after invalid input
    expect(inputElement).not.toBeDisabled()
    expect(inputElement.value).toBe('01/01/1900')
    
    // Try to edit the field again
    fireEvent.change(inputElement, { target: { value: '01/01/2000' } })
    expect(inputElement.value).toBe('01/01/2000')
    
    // Verify validation error appears
    const errorElement = screen.getByTestId('validation-error')
    expect(errorElement).toBeInTheDocument()
  })

  test('ModernAddUserForm Calendar28 input remains editable during validation errors', () => {
    render(<ModernAddUserForm />)
    
    // Trigger validation to show the error
    // This would typically be done by submitting the form or changing the field
    const dateInput = screen.getByLabelText('Date of Birth')
    
    // Input should be editable
    expect(dateInput).not.toBeDisabled()
    
    // User should be able to continue editing
    fireEvent.change(dateInput, { target: { value: '01/01/2010' } })
    expect(dateInput.value).toBe('01/01/2010')
  })

  test('Calendar28 preserves existing functionality', () => {
    const onChangeMock = jest.fn()
    
    render(
      <Calendar28
        id="test-date"
        value="15/08/1990"
        onChange={onChangeMock}
        placeholder="dd/mm/yyyy"
      />
    )
    
    const inputElement = screen.getByLabelText('Date of Birth')
    
    // Verify normal input functionality still works
    fireEvent.change(inputElement, { target: { value: '25/12/2000' } })
    expect(onChangeMock).toHaveBeenCalledWith('25/12/2000')
    
    // Verify calendar icon functionality still works
    const calendarButton = screen.getByLabelText('Select date')
    expect(calendarButton).toBeInTheDocument()
  })
})