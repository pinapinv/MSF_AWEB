import { Button as ButtonPrimitive } from '@base-ui/react/button'

export function Button({ className = '', variant = 'primary', ...props }) {
  return <ButtonPrimitive className={`button button-${variant} ${className}`} {...props} />
}
