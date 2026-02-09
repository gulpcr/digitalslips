/**
 * New Transaction Modal
 * Form to create a new transaction
 */

import React, { useState } from 'react';
import { FiX } from 'react-icons/fi';
import Button from '@components/ui/Button';
import Card from '@components/ui/Card';
import Input from '@components/ui/Input';
import toast from 'react-hot-toast';
import { transactionService, CreateTransactionData } from '@/services/transaction.service';

interface NewTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const NewTransactionModal: React.FC<NewTransactionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateTransactionData>({
    transaction_type: 'CASH_DEPOSIT',
    customer_cnic: '',
    customer_account: '',
    amount: 0,
    currency: 'PKR',
    narration: '',
    depositor_name: '',
    depositor_cnic: '',
    depositor_phone: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await transactionService.createTransaction(formData);
      toast.success('Transaction created successfully!');
      onSuccess();
      onClose();
      
      // Reset form
      setFormData({
        transaction_type: 'CASH_DEPOSIT',
        customer_cnic: '',
        customer_account: '',
        amount: 0,
        currency: 'PKR',
        narration: '',
        depositor_name: '',
        depositor_cnic: '',
        depositor_phone: '',
      });
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to create transaction';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <Card padding="lg">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-primary">New Transaction</h2>
            <button
              onClick={onClose}
              className="text-text-secondary hover:text-text-primary"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Transaction Type */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Transaction Type
              </label>
              <select
                className="w-full px-3 py-2 border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent"
                value={formData.transaction_type}
                onChange={(e) =>
                  setFormData({ ...formData, transaction_type: e.target.value })
                }
                required
              >
                <option value="CASH_DEPOSIT">Cash Deposit</option>
                <option value="CHEQUE_DEPOSIT">Cheque Deposit</option>
                <option value="PAY_ORDER">Pay Order</option>
                <option value="BILL_PAYMENT">Bill Payment</option>
                <option value="FUND_TRANSFER">Fund Transfer</option>
              </select>
            </div>

            {/* Customer CNIC */}
            <Input
              label="Customer CNIC"
              placeholder="42101-1234567-1"
              value={formData.customer_cnic}
              onChange={(e) =>
                setFormData({ ...formData, customer_cnic: e.target.value })
              }
              required
              fullWidth
            />

            {/* Customer Account */}
            <Input
              label="Customer Account Number"
              placeholder="0101234567890"
              value={formData.customer_account}
              onChange={(e) =>
                setFormData({ ...formData, customer_account: e.target.value })
              }
              required
              fullWidth
            />

            {/* Amount */}
            <Input
              label="Amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.amount || ''}
              onChange={(e) =>
                setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
              }
              required
              fullWidth
            />

            {/* Depositor Information */}
            <div className="pt-4 border-t border-border">
              <h3 className="text-lg font-semibold text-text-primary mb-4">
                Depositor Information (Optional)
              </h3>

              <div className="space-y-4">
                <Input
                  label="Depositor Name"
                  placeholder="Enter depositor name"
                  value={formData.depositor_name || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, depositor_name: e.target.value })
                  }
                  fullWidth
                />

                <Input
                  label="Depositor CNIC"
                  placeholder="42101-1234567-1"
                  value={formData.depositor_cnic || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, depositor_cnic: e.target.value })
                  }
                  fullWidth
                />

                <Input
                  label="Depositor Phone"
                  placeholder="+92-300-1234567"
                  value={formData.depositor_phone || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, depositor_phone: e.target.value })
                  }
                  fullWidth
                />
              </div>
            </div>

            {/* Narration */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Narration (Optional)
              </label>
              <textarea
                className="w-full px-3 py-2 border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent resize-y min-h-[80px]"
                placeholder="Enter transaction description"
                value={formData.narration || ''}
                onChange={(e) =>
                  setFormData({ ...formData, narration: e.target.value })
                }
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                fullWidth
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                fullWidth
                loading={loading}
              >
                Create Transaction
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default NewTransactionModal;
