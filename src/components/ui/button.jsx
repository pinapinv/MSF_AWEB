import { Button as ButtonPrimitive } from '@base-ui/react/button'

export function Button({ className = '', variant = 'primary', type = 'button', ...props }) {
  return <ButtonPrimitive type={type} className={`button button-${variant} ${className}`} {...props} />
}
